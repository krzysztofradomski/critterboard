/**
 * Square crops of a scan photo for the classifier.
 *
 * The model squashes whatever it gets to its input size (256×256). Fed a whole 12 MP frame, a bug inside the
 * reticle ends up a few dozen pixels wide on a busy background, which is far from the tightly
 * framed iNaturalist photos it was trained on. So Scan classifies square crops centred on the
 * reticle at a few sizes and averages the scores: the tight crop sees detail, the wider ones keep
 * context when the bug is big or off-centre, and averaging steadies damaged or half-hidden bugs.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

type Size = { width: number; height: number };
export type CropRect = { originX: number; originY: number; width: number; height: number };
/** The reticle in view coordinates: centre and side length. */
export type Reticle = { cx: number; cy: number; side: number };

/** Crop sides as multiples of the reticle; the last crop is always the photo's full short side. */
const RETICLE_SCALES = [1, 1.6];
/** Crops are downscaled before saving: the model only needs 256 px and small files decode fast. */
const CROP_PX = 320;

/**
 * Map the on-screen reticle into photo pixels. The camera preview fills the view like CSS
 * `cover` (scaled to fill, centred, overflow cut off), so the same mapping holds whether or not
 * the photo was already cropped to the preview's aspect ratio.
 */
export function reticleInPhoto(photo: Size, view: Size, reticle: Reticle): Reticle {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
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

/** Average several label → probability maps (one per crop) into one. */
export function meanScores(maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    for (const [label, p] of Object.entries(m)) out[label] = (out[label] ?? 0) + p / maps.length;
  }
  return out;
}

/**
 * Write the crops for `uri` and return their file URIs. `aim` is the reticle and the view it sits
 * in (camera shots). Without it (gallery picks) the crops centre on the photo, sized as if the
 * reticle spanned 60% of the short side, and the untouched photo is classified too.
 * On any failure it returns `[uri]`, which is what Scan classified before crops existed.
 */
export async function scanCrops(uri: string, aim?: { view: Size; reticle: Reticle }): Promise<string[]> {
  try {
    // Loading through the manipulator applies EXIF orientation, so width/height and the crops
    // are in upright pixels whatever the camera wrote.
    const photo = await ImageManipulator.manipulate(uri).renderAsync();
    const img = { width: photo.width, height: photo.height };
    const target = aim
      ? reticleInPhoto(img, aim.view, aim.reticle)
      : { cx: img.width / 2, cy: img.height / 2, side: 0.6 * Math.min(img.width, img.height) };
    const uris: string[] = [];
    for (const rect of cropRects(img, target)) {
      const crop = await ImageManipulator.manipulate(photo)
        .crop(rect)
        .resize({ width: Math.min(CROP_PX, rect.width) })
        .renderAsync();
      uris.push((await crop.saveAsync({ compress: 0.9, format: SaveFormat.JPEG })).uri);
      crop.release();
    }
    photo.release();
    return aim ? uris : [uri, ...uris];
  } catch {
    return [uri];
  }
}
