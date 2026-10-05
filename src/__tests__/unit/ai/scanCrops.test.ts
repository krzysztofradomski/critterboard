import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-manipulator', () => ({}));

import {
  combineScores, cropRects, meanScores, reticleInPhoto, squareAround, tapRects, tileRects,
} from '@/ai/scanCrops';

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

  it('maps a tap on a gallery photo shown whole (contain), letterboxed above and below', () => {
    // 393×852 view, 4000×3000 photo: width fits (scale 393/4000), bands above and below.
    const scale = 393 / 4000;
    const band = (852 - 3000 * scale) / 2;
    const p = reticleInPhoto({ width: 4000, height: 3000 }, { width: 393, height: 852 }, { cx: 393 / 2, cy: band + 10, side: 0 }, 'contain');
    expect(p.cx).toBeCloseTo(2000);
    expect(p.cy).toBeCloseTo(10 / scale);
  });

  it('crops around a tap at fruit-fly to butterfly sizes, inside the photo', () => {
    const rects = tapRects({ width: 3000, height: 4000 }, 2950, 100);
    expect(rects.map((r) => r.width)).toEqual([360, 750, 1500]);
    for (const r of rects) {
      expect(r.originX + r.width).toBeLessThanOrEqual(3000);
      expect(r.originY).toBeGreaterThanOrEqual(0);
    }
  });

  it('tiles the search area in a 3×3 grid that spans it edge to edge', () => {
    const rects = tileRects({ width: 3000, height: 4000 }, { cx: 1500, cy: 1840, side: 1000 });
    expect(rects).toHaveLength(9);
    expect(rects.every((r) => r.width === 400)).toBe(true);
    expect(Math.min(...rects.map((r) => r.originX))).toBe(1000);
    expect(Math.max(...rects.map((r) => r.originX + r.width))).toBe(2000);
    expect(Math.min(...rects.map((r) => r.originY))).toBe(1340);
    expect(Math.max(...rects.map((r) => r.originY + r.height))).toBe(2340);
  });

  it('keeps the most confident crop of each group, then averages the groups', () => {
    const tiles = [{ a: 0.3, b: 0.3 }, { a: 0.1, b: 0.9 }];   // tile 2 found the bug
    const m = combineScores([tiles, [{ a: 0.5, b: 0.5 }], []]);
    expect(m.a).toBeCloseTo(0.3);
    expect(m.b).toBeCloseTo(0.7);
  });
});
