import * as FileSystem from "expo-file-system/legacy";

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
  await FileSystem.deleteAsync(mapPackPath(dir, id), { idempotent: true }).catch(() => {});
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
  // Self-heal: a file that isn't valid PMTiles (partial copy, bad server) counts as not installed.
  if (!(await readPmtilesInfo(path))) {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    return null;
  }
  return path;
}

/**
 * Download a pack once. Writes to `<id>.pmtiles.part` and renames on success,
 * so an interrupted download is never mistaken for an installed pack.
 */
export async function downloadMapPack(
  id: string,
  url: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error("No document directory on this platform");
  await FileSystem.makeDirectoryAsync(`${dir}maps/`, { intermediates: true });

  const path = mapPackPath(dir, id);
  const partPath = `${path}.part`;
  const dl = FileSystem.createDownloadResumable(
    url,
    partPath,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite <= 0) return;
      onProgress?.(Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100));
    },
  );
  const result = await dl.downloadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(partPath, { idempotent: true });
    throw new Error(`Map pack download failed (HTTP ${result?.status ?? "?"})`);
  }
  // Never keep a truncated or wrong file: MapLibre would fail silently and the map stay blank.
  if (!(await readPmtilesInfo(partPath))) {
    await FileSystem.deleteAsync(partPath, { idempotent: true });
    throw new Error("Downloaded file is not a valid PMTiles map");
  }
  await FileSystem.moveAsync({ from: partPath, to: path });
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

/** Read a local pack's header; null on any failure (the map then just has no coverage mask). */
export async function readPmtilesInfo(fileUri: string): Promise<PackInfo | null> {
  try {
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 127,
    });
    const bin = atob(b64);
    return parsePmtilesHeader(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
