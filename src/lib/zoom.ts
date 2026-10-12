/**
 * Pinch-zoom / pan maths for the photo lightbox. Pure, and marked as worklets so the gesture
 * callbacks can run them on the UI thread. Translations are offsets of the image centre from
 * the view centre, in view points.
 */

export type Size = { w: number; h: number };
export type Point = { x: number; y: number };

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
/** Double tap zooms to this, or back to 1x when already zoomed. */
export const DOUBLE_TAP_SCALE = 2.5;

/** The image's size fitted inside the view (`contain`), at 1x. */
export function fitContain(view: Size, image: Size): Size {
  'worklet';
  if (image.w <= 0 || image.h <= 0) return { w: view.w, h: view.h };
  const k = Math.min(view.w / image.w, view.h / image.h);
  return { w: image.w * k, h: image.h * k };
}

export function clampScale(s: number): number {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Keep the image covering the view where it can: no gap past an edge that overflows. */
export function clampTranslate(scale: number, view: Size, content: Size, t: Point): Point {
  'worklet';
  const maxX = Math.max(0, (content.w * scale - view.w) / 2);
  const maxY = Math.max(0, (content.h * scale - view.h) / 2);
  // `+ 0` turns -0 into 0, so a fully clamped axis compares equal to 0.
  return { x: Math.min(maxX, Math.max(-maxX, t.x)) + 0, y: Math.min(maxY, Math.max(-maxY, t.y)) + 0 };
}

/**
 * Translation after zooming `from` → `to` around `focal` (relative to the view centre), so the
 * point under the fingers stays put.
 */
export function zoomAround(t: Point, focal: Point, from: number, to: number): Point {
  'worklet';
  const k = to / from;
  return { x: focal.x - (focal.x - t.x) * k + 0, y: focal.y - (focal.y - t.y) * k + 0 };
}

export function doubleTapScale(scale: number): number {
  'worklet';
  return scale > 1.05 ? MIN_SCALE : DOUBLE_TAP_SCALE;
}
