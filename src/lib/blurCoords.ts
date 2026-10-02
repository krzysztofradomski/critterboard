/** Public catch pins are blurred before they leave the device: a random point within ~500 m. */
const BLUR_M = 500;
const M_PER_DEG_LAT = 111_320;

export function blurCoords(
  lat: number,
  lng: number,
  rand: () => number = Math.random,
): { lat: number; lng: number } {
  // Uniform over a disc: sqrt keeps points from clustering at the centre.
  const r = BLUR_M * Math.sqrt(rand());
  const theta = 2 * Math.PI * rand();
  const dLat = (r * Math.sin(theta)) / M_PER_DEG_LAT;
  const dLng = (r * Math.cos(theta)) / (M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { lat: lat + dLat, lng: lng + dLng };
}
