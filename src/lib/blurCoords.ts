/**
 * Public catch pins are coarsened before they leave the device: snapped to the centre of a
 * ~700 m grid cell, so a pin is at most ~495 m from the real spot.
 *
 * A snap, not a random offset: a fresh random offset per catch averages out over many
 * catches from the same garden (to ~500/√(2n) m), while a cell centre stays put however
 * many catches there are.
 *
 * ponytail: a spot within GPS jitter (~20 m) of a cell edge lands in two cells, which
 * reveals that edge. Shift the grid by a per-device secret offset if that ever matters.
 */
const CELL_M = 700;
const M_PER_DEG_LAT = 111_320;

export function blurCoords(lat: number, lng: number): { lat: number; lng: number } {
  const dLat = CELL_M / M_PER_DEG_LAT;
  const cellLat = (Math.floor(lat / dLat) + 0.5) * dLat;
  const dLng = CELL_M / (M_PER_DEG_LAT * Math.max(Math.cos((cellLat * Math.PI) / 180), 0.01));
  const cellLng = (Math.floor(lng / dLng) + 0.5) * dLng;
  return { lat: cellLat, lng: cellLng };
}
