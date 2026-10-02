import { describe, expect, it } from 'vitest';

import { blurCoords } from '@/lib/blurCoords';

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((b.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

describe('blurCoords', () => {
  const p = { lat: 50.06, lng: 19.94 };
  it('stays within 500 m and usually moves the point', () => {
    let moved = 0;
    for (let i = 0; i < 200; i++) {
      const d = metres(blurCoords(p.lat, p.lng), p);
      expect(d).toBeLessThanOrEqual(500.5);
      if (d > 1) moved++;
    }
    expect(moved).toBeGreaterThan(190);
  });
  it('is deterministic for a fixed random source', () => {
    const r = () => 0.5;
    expect(blurCoords(p.lat, p.lng, r)).toEqual(blurCoords(p.lat, p.lng, r));
  });
});
