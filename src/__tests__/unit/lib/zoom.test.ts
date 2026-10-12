import { describe, expect, it } from 'vitest';

import { clampScale, clampTranslate, doubleTapScale, fitContain, zoomAround } from '@/lib/zoom';

const view = { w: 375, h: 812 };

describe('fitContain', () => {
  it('fits a landscape photo to the width', () => {
    expect(fitContain(view, { w: 4032, h: 3024 })).toEqual({ w: 375, h: 281.25 });
  });
  it('fits a portrait photo to the height when it is taller than the screen ratio', () => {
    expect(fitContain({ w: 400, h: 400 }, { w: 3024, h: 4032 })).toEqual({ w: 300, h: 400 });
  });
  it('copes with an unknown size', () => {
    expect(fitContain(view, { w: 0, h: 0 })).toEqual({ w: 375, h: 812 });
  });
});

describe('clampScale', () => {
  it('keeps 1x to 5x', () => {
    expect(clampScale(0.4)).toBe(1);
    expect(clampScale(3)).toBe(3);
    expect(clampScale(9)).toBe(5);
  });
});

describe('clampTranslate', () => {
  const content = { w: 375, h: 281.25 };
  it('allows no panning at 1x', () => {
    expect(clampTranslate(1, view, content, { x: 80, y: -40 })).toEqual({ x: 0, y: 0 });
  });
  it('stops at the image edges when zoomed', () => {
    // 2x: 750 wide (overflow 375, so +-187.5); 562.5 high, still shorter than the view, so no vertical pan.
    expect(clampTranslate(2, view, content, { x: 500, y: 300 })).toEqual({ x: 187.5, y: 0 });
    expect(clampTranslate(2, view, content, { x: -10, y: 0 })).toEqual({ x: -10, y: 0 });
  });
});

describe('zoomAround', () => {
  it('keeps the focal point still while zooming', () => {
    // Focal point 100 px right of centre; from 1x to 2x the content under it must stay put.
    const t = zoomAround({ x: 0, y: 0 }, { x: 100, y: 0 }, 1, 2);
    expect(t).toEqual({ x: -100, y: 0 });
  });
});

describe('doubleTapScale', () => {
  it('toggles between 1x and 2.5x', () => {
    expect(doubleTapScale(1)).toBe(2.5);
    expect(doubleTapScale(2.5)).toBe(1);
    expect(doubleTapScale(1.3)).toBe(1);
  });
});
