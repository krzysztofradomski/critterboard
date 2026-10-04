import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-manipulator', () => ({}));

import { cropRects, meanScores, reticleInPhoto, squareAround } from '@/ai/scanCrops';

describe('scanCrops geometry', () => {
  it('maps the reticle into a photo the preview fills like CSS cover', () => {
    // 393×852 pt screen, 3024×4032 photo: height fits (scale 852/4032), the sides are cut off.
    const r = reticleInPhoto({ width: 3024, height: 4032 }, { width: 393, height: 852 }, {
      cx: 196.5, cy: 852 * 0.46, side: 220,
    });
    expect(r.cx).toBeCloseTo(1512);
    expect(r.cy).toBeCloseTo(4032 * 0.46);
    expect(r.side).toBeCloseTo((220 * 4032) / 852);
  });

  it('maps exactly when the photo already has the preview aspect ratio', () => {
    const r = reticleInPhoto({ width: 786, height: 1704 }, { width: 393, height: 852 }, { cx: 100, cy: 200, side: 50 });
    expect(r).toEqual({ cx: 200, cy: 400, side: 100 });
  });

  it('keeps squares inside the image, shifting and shrinking as needed', () => {
    expect(squareAround({ width: 1000, height: 800 }, 50, 50, 200)).toEqual({ originX: 0, originY: 0, width: 200, height: 200 });
    expect(squareAround({ width: 1000, height: 800 }, 990, 790, 200)).toEqual({ originX: 800, originY: 600, width: 200, height: 200 });
    expect(squareAround({ width: 1000, height: 800 }, 500, 400, 5000)).toEqual({ originX: 100, originY: 0, width: 800, height: 800 });
  });

  it('makes reticle-sized, wider and full short-side crops', () => {
    const rects = cropRects({ width: 3000, height: 4000 }, { cx: 1500, cy: 1840, side: 1000 });
    expect(rects.map((r) => r.width)).toEqual([1000, 1600, 3000]);
    expect(rects[0]).toEqual({ originX: 1000, originY: 1340, width: 1000, height: 1000 });
  });

  it('averages per-crop probabilities, counting a missing label as 0', () => {
    const m = meanScores([{ a: 0.8, b: 0.2 }, { a: 0.4, b: 0.5, c: 0.1 }]);
    expect(m.a).toBeCloseTo(0.6);
    expect(m.b).toBeCloseTo(0.35);
    expect(m.c).toBeCloseTo(0.05);
  });
});
