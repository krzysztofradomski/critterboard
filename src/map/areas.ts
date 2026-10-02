import type { PackBounds } from "@/map/mapPack";

/**
 * Street-detail "area packs": a small PMTiles file (zoom ≤ 13) covering a
 * square around a place, drawn over the Europe base map. They are listed in
 * `packs/areas.json`; an entry without a `url` isn't hosted yet and is never
 * offered. Cut new ones with `tools/map/extract-area.sh`.
 */
export type AreaPack = {
  id: string;
  /** Display name (a place name, same in every language). */
  name: string;
  /** [lng, lat] */
  center: [number, number];
  radiusKm: number;
  maxZoom: number;
  /** Download size in MB. */
  mb: number;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  url?: string;
};

export const AREAS_MANIFEST_URL =
  process.env.EXPO_PUBLIC_AREAS_URL?.trim() ||
  "https://raw.githubusercontent.com/krzysztofradomski/critterboard/main/packs/areas.json";

/** Square around a point, `radiusKm` from the centre to each side (same maths as extract-area.sh). */
export function bboxForRadius(lat: number, lng: number, radiusKm: number): PackBounds {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { minLng: lng - dLng, minLat: lat - dLat, maxLng: lng + dLng, maxLat: lat + dLat };
}

function contains(a: AreaPack, lat: number, lng: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = a.bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

/** The hosted area whose box contains the point (nearest centre if several), or null. */
export function pickArea(areas: readonly AreaPack[], lat: number, lng: number): AreaPack | null {
  let best: AreaPack | null = null;
  let bestDist = Infinity;
  for (const a of areas) {
    if (!a.url || !contains(a, lat, lng)) continue;
    const dist = (a.center[1] - lat) ** 2 + (a.center[0] - lng) ** 2;
    if (dist < bestDist) {
      best = a;
      bestDist = dist;
    }
  }
  return best;
}

/** The catalog of area packs; empty on any failure (offline, bad JSON). */
export async function fetchAreaCatalog(): Promise<AreaPack[]> {
  try {
    const res = await fetch(AREAS_MANIFEST_URL);
    if (!res.ok) return [];
    const json = (await res.json()) as { areas?: AreaPack[] };
    return Array.isArray(json.areas) ? json.areas : [];
  } catch {
    return [];
  }
}
