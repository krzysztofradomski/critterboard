import { describe, expect, it } from 'vitest';

import { parsePmtilesHeader } from '@/map/mapPack';

function header(bounds: [number, number, number, number], version = 3): Uint8Array {
  const bytes = new Uint8Array(127);
  bytes.set(Array.from('PMTiles', (c) => c.charCodeAt(0)));
  bytes[7] = version;
  bytes[100] = 2;
  bytes[101] = 7;
  const view = new DataView(bytes.buffer);
  bounds.forEach((deg, i) => view.setInt32(102 + i * 4, Math.round(deg * 1e7), true));
  return bytes;
}

describe('parsePmtilesHeader', () => {
  it('reads zoom range and min/max lon/lat (E7 degrees) from the v3 header', () => {
    const b = parsePmtilesHeader(header([19.79, 49.97, 20.22, 50.13]));
    expect(b?.minLng).toBeCloseTo(19.79, 5);
    expect(b?.minLat).toBeCloseTo(49.97, 5);
    expect(b?.maxLng).toBeCloseTo(20.22, 5);
    expect(b?.maxLat).toBeCloseTo(50.13, 5);
    expect(b?.minZoom).toBe(2);
    expect(b?.maxZoom).toBe(7);
  });

  it('handles negative coordinates', () => {
    const b = parsePmtilesHeader(header([-74.1, -33.9, -73.9, -33.7]));
    expect(b?.minLng).toBeCloseTo(-74.1, 5);
    expect(b?.minLat).toBeCloseTo(-33.9, 5);
  });

  it('rejects non-PMTiles or short data', () => {
    expect(parsePmtilesHeader(new Uint8Array(10))).toBeNull();
    expect(parsePmtilesHeader(header([0, 0, 1, 1], 2))).toBeNull();
    expect(parsePmtilesHeader(new Uint8Array(127))).toBeNull();
  });
});

import { resolveMapUrl } from '@/map/mapPack';

describe('resolveMapUrl', () => {
  it("prefers the region pack's own map", () => {
    expect(resolveMapUrl({ mapUrl: 'https://x/eu-ce.pmtiles' }, 'http://localhost/dev.pmtiles')).toBe(
      'https://x/eu-ce.pmtiles',
    );
  });

  it('falls back to the dev override, then to nothing', () => {
    expect(resolveMapUrl({}, 'http://localhost/dev.pmtiles')).toBe('http://localhost/dev.pmtiles');
    expect(resolveMapUrl(null, null)).toBeNull();
    expect(resolveMapUrl({}, null)).toBeNull();
  });
});
