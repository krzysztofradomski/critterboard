/** Pixel helpers for the live guess (worklets: they run on VisionCamera's frame threads). */
import type { CameraOrientation } from 'react-native-vision-camera';

/** Degrees to turn the pixels upright: `orientation` is how far they are rotated (VisionCamera). */
export function uprightDegrees(o: CameraOrientation): number {
  'worklet';
  // ponytail: sign follows nitro-image's rotate(); a bug upside down still classifies fine.
  return o === 'right' ? -90 : o === 'left' ? 90 : o === 'down' ? 180 : 0;
}

/** RGBA/BGRA-style 4-byte pixels → packed RGB, the layout ExecuTorch's PixelData expects. */
export function toRgb(buf: ArrayBuffer, format: string): Uint8Array {
  'worklet';
  const src = new Uint8Array(buf);
  const n = src.length / 4;
  const out = new Uint8Array(n * 3);
  // Byte offsets of R, G and B inside one 4-byte pixel.
  const [r, g, b] =
    format === 'BGRA' || format === 'BGRX' ? [2, 1, 0]
    : format === 'ARGB' || format === 'XRGB' ? [1, 2, 3]
    : format === 'ABGR' || format === 'XBGR' ? [3, 2, 1]
    : [0, 1, 2];
  for (let i = 0; i < n; i++) {
    out[i * 3] = src[i * 4 + r]!;
    out[i * 3 + 1] = src[i * 4 + g]!;
    out[i * 3 + 2] = src[i * 4 + b]!;
  }
  return out;
}
