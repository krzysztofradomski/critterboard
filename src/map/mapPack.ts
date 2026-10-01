import * as FileSystem from "expo-file-system/legacy";

/**
 * Offline map packs: one PMTiles file per region, downloaded once into the
 * app's document directory and read locally by MapLibre from then on.
 *
 * Spike scope: a single dev pack whose URL comes from
 * `EXPO_PUBLIC_MAP_PACK_URL` (see `tools/map/README.md`). Region packs will
 * carry their own `mapUrl` once the spike is proven on device.
 */

export const DEV_MAP_PACK_ID = "dev";

export function mapPackPath(documentDirectory: string, id: string): string {
  return `${documentDirectory}maps/${id}.pmtiles`;
}

export function devMapPackUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_MAP_PACK_URL?.trim();
  return url ? url : null;
}

/** Local file URI of an installed pack, or null when it isn't on disk. */
export async function installedMapPack(id: string): Promise<string | null> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  const path = mapPackPath(dir, id);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists && !info.isDirectory ? path : null;
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
  await FileSystem.moveAsync({ from: partPath, to: path });
  return path;
}

export type PackBounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/**
 * Geographic coverage of a PMTiles v3 archive, from its 127-byte header
 * (int32 E7 degrees at bytes 102..117). Null if the bytes aren't PMTiles.
 */
export function parsePmtilesBounds(header: Uint8Array): PackBounds | null {
  if (header.length < 118) return null;
  const magic = String.fromCharCode(...header.slice(0, 7));
  if (magic !== 'PMTiles' || header[7] !== 3) return null;
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const deg = (offset: number) => view.getInt32(offset, true) / 1e7;
  return { minLng: deg(102), minLat: deg(106), maxLng: deg(110), maxLat: deg(114) };
}

/** Read a local pack's coverage; null on any failure (the map then just has no coverage mask). */
export async function readPmtilesBounds(fileUri: string): Promise<PackBounds | null> {
  try {
    const b64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 127,
    });
    const bin = atob(b64);
    return parsePmtilesBounds(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
