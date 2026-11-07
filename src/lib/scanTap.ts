export type Point = { x: number; y: number };
export type ScanTap = { point: Point; at: number };

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 32;

export function isScanDoubleTap(first: ScanTap | null, point: Point, startedAt: number): boolean {
  return first !== null &&
    startedAt - first.at <= DOUBLE_TAP_MS &&
    Math.hypot(point.x - first.point.x, point.y - first.point.y) <= DOUBLE_TAP_DISTANCE;
}
