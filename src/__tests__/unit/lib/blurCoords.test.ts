import { describe, expect, it } from 'vitest';

import { blurCoords } from '@/lib/blurCoords';

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((b.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

describe('blurCoords', () => {
  it('stays within 500 m of the real spot, anywhere in Europe', () => {
    for (let i = 0; i < 2000; i++) {
      const p = { lat: 35 + Math.random() * 35, lng: -10 + Math.random() * 40 };
      expect(metres(blurCoords(p.lat, p.lng), p)).toBeLessThanOrEqual(500);
    }
  });

  it('gives every catch around one garden the same public point, so averaging many reveals nothing more', () => {
    const home = blurCoords(50.0612, 19.9373);
    const nearby = Array.from({ length: 50 }, () => blurCoords(50.0612 + (Math.random() - 0.5) * 2e-4, 19.9373 + (Math.random() - 0.5) * 2e-4));
    // ±11 m of GPS jitter; this garden is 112 m from its cell's nearest edge, so all stay in.
    expect(nearby.filter((q) => q.lat === home.lat && q.lng === home.lng)).toHaveLength(50);
  });

  it('moves the point', () => {
    expect(metres(blurCoords(50.0612, 19.9373), { lat: 50.0612, lng: 19.9373 })).toBeGreaterThan(1);
  });
});
