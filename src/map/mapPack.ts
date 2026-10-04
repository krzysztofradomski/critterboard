import * as FileSystem from "expo-file-system/legacy";

import { downloadFile } from "@/lib/download";

/**
 * Offline maps: one PMTiles file per region pack, downloaded on demand into
 * the app's document directory (alongside that region's model and species
 * list) and read locally by MapLibre from then on. A region pack declares its
 * map with `mapUrl`; `EXPO_PUBLIC_MAP_PACK_URL` is a dev-only fallback so a
 * locally served file can stand in until the maps are hosted.
 */

/** Spike-era packs, deleted on sight to free space. */
const LEGACY_PACK_IDS = ["dev", "europe"];

export function mapPackPath(documentDirectory: string, id: string): string {
  return `${documentDirectory}maps/${id}.pmtiles`;
}

export function devMapPackUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_MAP_PACK_URL?.trim();
  return url ? url : null;
}

/** Where a region's map comes from: its own `mapUrl`, else the dev override, else nowhere. */
export function resolveMapUrl(
  pack: { mapUrl?: string } | null | undefined,
  devUrl: string | null = devMapPackUrl(),
): string | null {
  return pack?.mapUrl || devUrl || null;
}

/** Delete a region's downloaded map (uninstalling the region). */
export async function removeMapPack(id: string): Promise<void> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return;
  infoByPath.delete(mapPackPath(dir, id));
  await FileSystem.deleteAsync(mapPackPath(dir, id), { idempotent: true }).catch(() => {});
}

// Header of each installed map, kept from the check in `installedMapPack` (which runs on every
// Map visit), so OfflineMap builds its style once, with coverage, instead of twice.
const infoByPath = new Map<string, PackInfo>();

/** The header read when the map at this path was last checked, if it was. */
export function cachedPmtilesInfo(fileUri: string): PackInfo | undefined {
  return infoByPath.get(fileUri);
}

/** Local file URI of an installed pack, or null when it isn't on disk. */
export async function installedMapPack(id: string): Promise<string | null> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  for (const legacy of LEGACY_PACK_IDS) {
    await FileSystem.deleteAsync(mapPackPath(dir, legacy), { idempotent: true }).catch(() => {});
  }
  const path = mapPackPath(dir, id);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists || info.isDirectory) return null;
  // Self-heal: a file that isn't a whole PMTiles archive (partial copy, bad server) counts as not installed.
  const header = await completePmtilesInfo(path);
  if (!header) {
    infoByPath.delete(path);
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    return null;
  }
  infoByPath.set(path, header);
  return path;
}

type MapSource = { mapUrl?: string; mapBytes?: number; mapMd5?: string };

/**
 * Download a region's map once (see `downloadFile`): never a truncated, corrupted or
 * non-PMTiles file, or MapLibre would fail silently and the map stay blank.
 */
export async function downloadMapPack(
  id: string,
  pack: MapSource | null | undefined,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const url = resolveMapUrl(pack);
  if (!url) throw new Error("This region has no map");
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error("No document directory on this platform");
  await FileSystem.makeDirectoryAsync(`${dir}maps/`, { intermediates: true });

  const path = mapPackPath(dir, id);
  // The pinned checksum belongs to the pack's own map, not to a dev override.
  const expect = url === pack?.mapUrl ? { bytes: pack.mapBytes, md5: pack.mapMd5 } : undefined;
  await downloadFile(url, path, { expect, verify: isCompletePmtiles, onProgress });
  return path;
}

export type PackBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };
/** What the PMTiles header says about a pack: where it has data and how deep (zoom). */
export type PackInfo = PackBounds & { minZoom: number; maxZoom: number };

/**
 * Coverage of a PMTiles v3 archive from its 127-byte header: zoom range at
 * bytes 100/101, int32 E7 degrees at 102..117. Null if the bytes aren't PMTiles.
 */
export function parsePmtilesHeader(header: Uint8Array): PackInfo | null {
  if (header.length < 118) return null;
  const magic = String.fromCharCode(...header.slice(0, 7));
  if (magic !== 'PMTiles' || header[7] !== 3) return null;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const deg = (offset: number) => view.getInt32(offset, true) / 1e7;
  return {
    minLng: deg(102),
    minLat: deg(106),
    maxLng: deg(110),
    maxLat: deg(114),
    minZoom: header[100]!,
    maxZoom: header[101]!,
  };
}

/**
 * Where a PMTiles v3 archive must end: the furthest end of its four sections (root
 * directory, metadata, leaf directories, tile data), each a little-endian u64 offset and
 * length pair at bytes 8..71. Null if the bytes aren't PMTiles.
 */
export function pmtilesEnd(header: Uint8Array): number | null {
  if (!parsePmtilesHeader(header)) return null;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const u64 = (offset: number) => view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 2 ** 32;
  return Math.max(...[8, 24, 40, 56].map((at) => u64(at) + u64(at + 8)));
}

async function readHeader(fileUri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
    position: 0,
    length: 127,
  });
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Read a local pack's header; null on any failure (the map then just has no coverage mask). */
export async function readPmtilesInfo(fileUri: string): Promise<PackInfo | null> {
  try {
    return parsePmtilesHeader(await readHeader(fileUri));
  } catch {
    return null;
  }
}

/** Is this a whole PMTiles archive? A valid header alone isn't enough: a cut-off file has one too. */
export async function isCompletePmtiles(fileUri: string): Promise<boolean> {
  return (await completePmtilesInfo(fileUri)) !== null;
}

/** The header of a whole PMTiles archive, or null if the file isn't one. */
async function completePmtilesInfo(fileUri: string): Promise<PackInfo | null> {
  try {
    const header = await readHeader(fileUri);
    const end = pmtilesEnd(header);
    const info = await FileSystem.getInfoAsync(fileUri);
    return end !== null && info.exists && info.size >= end ? parsePmtilesHeader(header) : null;
  } catch {
    return null;
  }
}

