/**
 * Square crops of a scan photo for the classifier.
 *
 * The model squashes whatever it gets to its input size (256×256). Fed a whole 12 MP frame, a bug inside the
 * reticle ends up a few dozen pixels wide on a busy background, which is far from the tightly
 * framed iNaturalist photos it was trained on. So Scan classifies square crops:
 *
 * - **Tapped:** the user marked the bug. Crops of a few sizes around the tap; the most confident
 *   one wins (the right size depends on the bug, which the tap doesn't tell).
 * - **Not tapped:** auto search. A grid of tiles over the reticle finds a small bug anywhere in it
 *   (the most confident tile), averaged with crops centred on the reticle, which keep big bugs whole.
 *
 * On synthetic shots (docs/ml-roadmap.md, "Scan preprocessing") a fruit-fly-sized bug went from 5%
 * top-1 with reticle crops alone to ~27% with auto search and ~48% when tapped.
 *
 * Crops are returned in groups: the classifier keeps the most confident crop of each group and
 * averages the groups (see combineScores).
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

type Size = { width: number; height: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };
/** The reticle in view coordinates: centre and side length. */
export type Reticle = { cx: number; cy: number; side: number };
/** How the photo fills the view: like the camera preview (`cover`) or shown whole (`contain`). */
export type Fit = 'cover' | 'contain';
/**
 * Where to look, in view coordinates. `reticle` is the on-screen reticle (camera shots); without
 * it the search area is the photo centre. `tap` is where the user marked the bug.
 */
export type Aim = { view: Size; fit: Fit; reticle?: Reticle; tap?: { x: number; y: number } };

/** Crop sides as multiples of the reticle; the last crop is always the photo's full short side. */
const RETICLE_SCALES = [1, 1.6];
/** Crops around a tap, as fractions of the photo's short side: fruit fly to butterfly. */
const TAP_FRACS = [0.12, 0.25, 0.5];
/** Auto-search tiles: side and step as fractions of the reticle (a 3×3 grid). */
const TILE = 0.4;
const TILE_STEP = 0.3;
/** The search area for photos without a reticle (gallery), as a fraction of the short side. */
const CENTRE_FRAC = 0.6;
/** Crops are downscaled before saving: the model only needs 256 px and small files decode fast. */
const CROP_PX = 320;

/**
 * Map a square in view coordinates into photo pixels. The camera preview fills the view like CSS
 * `cover` (scaled to fill, centred, overflow cut off), so that mapping holds whether or not the
 * photo was already cropped to the preview's aspect ratio. A gallery photo is shown `contain`.
 */
export function reticleInPhoto(photo: Size, view: Size, reticle: Reticle, fit: Fit = 'cover'): Reticle {
  const pick = fit === 'cover' ? Math.max : Math.min;
  const scale = pick(view.width / photo.width, view.height / photo.height);
  const offX = (view.width - photo.width * scale) / 2;
  const offY = (view.height - photo.height * scale) / 2;
  return {
    cx: (reticle.cx - offX) / scale,
    cy: (reticle.cy - offY) / scale,
    side: reticle.side / scale,
  };
}

/** A square of `side` centred on (cx, cy), shrunk to fit the image and shifted inside it. */
export function squareAround(img: Size, cx: number, cy: number, side: number): CropRect {
  const s = Math.round(Math.min(side, img.width, img.height));
  const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(v, 0), max));
  return {
    originX: clamp(cx - s / 2, img.width - s),
    originY: clamp(cy - s / 2, img.height - s),
    width: s,
    height: s,
  };
}

/** The crop rectangles for a photo: reticle-sized squares, then the largest square. */
export function cropRects(img: Size, target: Reticle): CropRect[] {
  const sides = [...RETICLE_SCALES.map((k) => k * target.side), Math.min(img.width, img.height)];
  return sides.map((side) => squareAround(img, target.cx, target.cy, side));
}

/** Squares around a tapped point, sized for anything from a fruit fly to a butterfly. */
export function tapRects(img: Size, x: number, y: number): CropRect[] {
  const short = Math.min(img.width, img.height);
  return TAP_FRACS.map((f) => squareAround(img, x, y, f * short));
}

/** A grid of tiles covering the search area, for a small bug anywhere in it. */
export function tileRects(img: Size, area: Reticle): CropRect[] {
  const side = TILE * area.side;
  const n = Math.round((1 - TILE) / TILE_STEP) + 1;
  const x0 = area.cx - area.side / 2 + side / 2;
  const y0 = area.cy - area.side / 2 + side / 2;
  const rects: CropRect[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      rects.push(squareAround(img, x0 + i * TILE_STEP * area.side, y0 + j * TILE_STEP * area.side, side));
    }
  }
  return rects;
}

/** Average several label → probability maps (one per crop) into one. */
export function meanScores(maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    for (const [label, p] of Object.entries(m)) out[label] = (out[label] ?? 0) + p / maps.length;
  }
  return out;
}

const topScore = (m: Record<string, number>) => Math.max(0, ...Object.values(m));

/** The most confident of several score maps. */
export function mostConfident(maps: Record<string, number>[]): Record<string, number> {
  return maps.reduce((best, m) => (topScore(m) > topScore(best) ? m : best));
}

/** Groups of per-crop scores → one map: the most confident crop of each group, averaged. */
export function combineScores(groups: Record<string, number>[][]): Record<string, number> {
  return meanScores(groups.filter((g) => g.length > 0).map(mostConfident));
}

/**
 * Write the crops for `uri` and return their file URIs, in groups (see combineScores). With a tap:
 * one group of crops around it. Without: one group of search tiles, then each crop centred on the
 * search area as its own group (plus the untouched photo for gallery picks). On any failure it
 * returns `[[uri]]`, which is what Scan classified before crops existed.
 */
export async function scanCrops(uri: string, aim?: Aim): Promise<string[][]> {
  try {
    // Loading through the manipulator applies EXIF orientation, so width/height and the crops
    // are in upright pixels whatever the camera wrote.
    const photo = await ImageManipulator.manipulate(uri).renderAsync();
    const img = { width: photo.width, height: photo.height };
    const save = async (rects: CropRect[]) => {
      const uris: string[] = [];
      for (const rect of rects) {
        const crop = await ImageManipulator.manipulate(photo)
          .crop(rect)
          .resize({ width: Math.min(CROP_PX, rect.width) })
          .renderAsync();
        uris.push((await crop.saveAsync({ compress: 0.9, format: SaveFormat.JPEG })).uri);
        crop.release();
      }
      return uris;
    };

    let groups: string[][];
    if (aim?.tap) {
      const p = reticleInPhoto(img, aim.view, { cx: aim.tap.x, cy: aim.tap.y, side: 0 }, aim.fit);
      groups = [await save(tapRects(img, p.cx, p.cy))];
    } else {
      const area = aim?.reticle
        ? reticleInPhoto(img, aim.view, aim.reticle, aim.fit)
        : { cx: img.width / 2, cy: img.height / 2, side: CENTRE_FRAC * Math.min(img.width, img.height) };
      const tiles = await save(tileRects(img, area));
      const centred = await save(cropRects(img, area));
      groups = [tiles, ...centred.map((u) => [u]), ...(aim?.reticle ? [] : [[uri]])];
    }
    photo.release();
    return groups;
  } catch {
    return [[uri]];
  }
}
