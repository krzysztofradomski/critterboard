import { describe, expect, it } from 'vitest';

import { parsePmtilesBounds } from '@/map/mapPack';

function header(bounds: [number, number, number, number], version = 3): Uint8Array {
  const bytes = new Uint8Array(127);
  bytes.set(Array.from('PMTiles', (c) => c.charCodeAt(0)));
  bytes[7] = version;
  const view = new DataView(bytes.buffer);
  bounds.forEach((deg, i) => view.setInt32(102 + i * 4, Math.round(deg * 1e7), true));
  return bytes;
}

describe('parsePmtilesBounds', () => {
  it('reads min/max lon/lat (E7 degrees) from the v3 header', () => {
    const b = parsePmtilesBounds(header([19.79, 49.97, 20.22, 50.13]));
    expect(b?.minLng).toBeCloseTo(19.79, 5);
    expect(b?.minLat).toBeCloseTo(49.97, 5);
    expect(b?.maxLng).toBeCloseTo(20.22, 5);
    expect(b?.maxLat).toBeCloseTo(50.13, 5);
  });

  it('handles negative coordinates', () => {
    const b = parsePmtilesBounds(header([-74.1, -33.9, -73.9, -33.7]));
    expect(b?.minLng).toBeCloseTo(-74.1, 5);
    expect(b?.minLat).toBeCloseTo(-33.9, 5);
  });

  it('rejects non-PMTiles or short data', () => {
    expect(parsePmtilesBounds(new Uint8Array(10))).toBeNull();
    expect(parsePmtilesBounds(header([0, 0, 1, 1], 2))).toBeNull();
    expect(parsePmtilesBounds(new Uint8Array(127))).toBeNull();
  });
});
