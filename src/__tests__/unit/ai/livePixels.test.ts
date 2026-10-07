import { describe, expect, it } from 'vitest';

import { toRgb, uprightDegrees } from '@/ai/livePixels';

// Two pixels: red, then blue, in each 4-byte layout.
const px = (layout: string) => {
  const red = { R: 255, G: 0, B: 0, A: 9, X: 9 };
  const blue = { R: 0, G: 0, B: 255, A: 9, X: 9 };
  return new Uint8Array([red, blue].flatMap((p) => [...layout].map((c) => p[c as keyof typeof p]))).buffer;
};

describe('toRgb', () => {
  it.each(['RGBA', 'BGRA', 'ARGB', 'ABGR', 'RGBX', 'BGRX', 'XRGB', 'XBGR'])('%s → packed RGB', (layout) => {
    expect([...toRgb(px(layout), layout)]).toEqual([255, 0, 0, 0, 0, 255]);
  });
});

describe('uprightDegrees', () => {
  it('counter-rotates the frame orientation', () => {
    expect(['up', 'right', 'down', 'left'].map((o) => uprightDegrees(o as never))).toEqual([0, -90, 180, 90]);
  });
});
