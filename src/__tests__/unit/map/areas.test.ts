import { describe, expect, it } from 'vitest';

import { bboxForRadius, pickArea, type AreaPack } from '@/map/areas';

const krakow: AreaPack = {
  id: 'krakow',
  name: 'Kraków',
  center: [19.9366, 50.0614],
  radiusKm: 25,
  maxZoom: 13,
  mb: 21,
  bbox: [19.5868, 49.8368, 20.2864, 50.286],
  url: 'https://example.test/area-krakow.pmtiles',
};

describe('bboxForRadius', () => {
  it('matches the box tools/map/extract-area.sh cuts for Kraków (25 km)', () => {
    const b = bboxForRadius(50.0614, 19.9366, 25);
    expect(b.minLng).toBeCloseTo(19.5868, 3);
    expect(b.minLat).toBeCloseTo(49.8368, 3);
    expect(b.maxLng).toBeCloseTo(20.2864, 3);
    expect(b.maxLat).toBeCloseTo(50.286, 3);
  });

  it('widens in longitude toward the poles', () => {
    const equator = bboxForRadius(0, 0, 25);
    const north = bboxForRadius(60, 0, 25);
    expect(north.maxLng - north.minLng).toBeGreaterThan(equator.maxLng - equator.minLng);
  });
});

describe('pickArea', () => {
  it('returns the area containing the point', () => {
    expect(pickArea([krakow], 50.06, 19.94)?.id).toBe('krakow');
  });

  it('returns null outside every area', () => {
    expect(pickArea([krakow], 52.23, 21.01)).toBeNull(); // Warsaw
  });

  it('never offers an area that is not hosted (no url)', () => {
    const { url: _url, ...unhosted } = krakow;
    expect(pickArea([unhosted], 50.06, 19.94)).toBeNull();
  });

  it('prefers the nearest centre when areas overlap', () => {
    const near: AreaPack = { ...krakow, id: 'near', center: [19.95, 50.07] };
    expect(pickArea([krakow, near], 50.07, 19.95)?.id).toBe('near');
  });
});
