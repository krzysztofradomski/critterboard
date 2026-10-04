import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { ensurePackIcons, type PackIcons } from '@/data/bugIcons';
import { mergeBugs, type Bug } from '@/data/bugs';
import { downloadFile } from '@/lib/download';

export type RegionPack = {
  id: string;
  version: number;
  /** GitHub release asset URL for the .pte model file. */
  modelUrl: string;
  modelVersion: number;
  /** Pinned size and MD5 of the model (tools/packs/pin_checksums.py); checked after download. */
  modelBytes?: number;
  modelMd5?: string;
  bugs: Bug[];
  /** scientific name → class index, matching the model's output layer. */
  labelMap: Record<string, number>;
  /** Photo-based species icons (pack v5+); see bugIcons.ts. */
  icons?: PackIcons;
  /** Offline map (PMTiles) for this region, downloaded with the pack. Absent until hosted. */
  mapUrl?: string;
  mapVersion?: number;
  mapBytes?: number;
  mapMd5?: string;
};

export type PackManifest = {
  manifest: 1;
  packs: Partial<Record<string, { version: number; url: string }>>;
};

export const PACK_MANIFEST_URL =
  'https://raw.githubusercontent.com/krzysztofradomski/critterboard/main/packs/manifest.json';

const STORAGE_PREFIX = 'critterboard:regionpack:';

// In-memory registry, populated by hydrateInstalledPacks() at boot.
const _packs = new Map<string, RegionPack>();

export function getPackData(id: string): RegionPack | null {
  return _packs.get(id) ?? null;
}

export function getModelPath(documentDirectory: string, regionId: string): string {
  return `${documentDirectory}models/packs/${regionId}.pte`;
}

// A pack's JSON (~0.7 MB for eu-ce, all species and names) lives in a file. It used to be one
// AsyncStorage value, which Android can't read back past ~2 MB; that copy is moved on first read.
// Platforms without a document directory (web) keep using AsyncStorage.
function packFile(id: string): string | null {
  const dir = FileSystem.documentDirectory;
  return dir ? `${dir}packs/${id}.json` : null;
}

async function readCached(id: string): Promise<RegionPack | null> {
  try {
    const file = packFile(id);
    if (file && (await FileSystem.getInfoAsync(file)).exists) {
      return JSON.parse(await FileSystem.readAsStringAsync(file)) as RegionPack;
    }
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    const pack = JSON.parse(raw) as RegionPack;
    if (file) {
      await writePackFile(file, raw);
      await AsyncStorage.removeItem(STORAGE_PREFIX + id);
    }
    return pack;
  } catch {
    return null;
  }
}

async function writePackFile(file: string, json: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(file.slice(0, file.lastIndexOf('/') + 1), { intermediates: true });
  // Write aside and move, so a crash mid-write never leaves half a pack where a whole one was.
  await FileSystem.writeAsStringAsync(`${file}.part`, json);
  await FileSystem.deleteAsync(file, { idempotent: true });
  await FileSystem.moveAsync({ from: `${file}.part`, to: file });
}

export async function cachePackData(pack: RegionPack): Promise<void> {
  try {
    const json = JSON.stringify(pack);
    const file = packFile(pack.id);
    if (file) await writePackFile(file, json);
    else await AsyncStorage.setItem(STORAGE_PREFIX + pack.id, json);
    _packs.set(pack.id, pack);
    mergeBugs(pack.bugs);
  } catch {
    // non-fatal — the pack stays in-memory even if storage write fails
  }
}

export async function removeCachedPack(id: string): Promise<void> {
  try {
    const file = packFile(id);
    if (file) await FileSystem.deleteAsync(file, { idempotent: true });
    await AsyncStorage.removeItem(STORAGE_PREFIX + id);
    _packs.delete(id);
  } catch {
    // non-fatal
  }
}

/**
 * Called at app boot with the persisted list of installed region IDs.
 * Reads each pack's JSON from AsyncStorage and merges its species into
 * the in-memory bug registry so findBug() covers all installed regions.
 * Icons are registered (or fetched, if missing) in the background.
 */
export async function hydrateInstalledPacks(
  installedIds: string[],
  documentDirectory: string | null = null,
): Promise<void> {
  await Promise.all(
    installedIds.map(async (id) => {
      const pack = await readCached(id);
      if (!pack) return;
      _packs.set(id, pack);
      mergeBugs(pack.bugs);
      void ensurePackIcons(documentDirectory, pack);
    }),
  );
}

// ── Update / refresh ─────────────────────────────────────────────────────────

/** Fetch the top-level pack manifest. Returns null on any network/parse error. */
export async function fetchPackManifest(): Promise<PackManifest | null> {
  try {
    const res = await fetch(PACK_MANIFEST_URL);
    if (!res.ok) return null;
    return (await res.json()) as PackManifest;
  } catch {
    return null;
  }
}

/** Fetch a single pack's JSON (bugs + labelMap + modelUrl). */
export async function fetchPack(url: string): Promise<RegionPack | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as RegionPack;
  } catch {
    return null;
  }
}

/**
 * Download a pack's .pte model to its on-disk path, reporting 0–100 progress. Checked
 * against the pinned size/MD5 and swapped in only when complete, so a failed update never
 * replaces a working model.
 */
export async function downloadPackModel(
  documentDirectory: string,
  pack: RegionPack,
  onProgress?: (pct: number) => void,
  onStart?: (dl: FileSystem.DownloadResumable) => void,
): Promise<void> {
  await FileSystem.makeDirectoryAsync(`${documentDirectory}models/packs/`, {
    intermediates: true,
  });
  await downloadFile(pack.modelUrl, getModelPath(documentDirectory, pack.id), {
    expect: { bytes: pack.modelBytes, md5: pack.modelMd5 },
    onProgress,
    onStart,
  });
}

/**
 * Does an updated pack need its model downloaded again? Only when the model
 * URL or its pinned checksum changed, or the file is missing (a pack update
 * may only add icons or names, and the model is ~90 MB).
 */
export async function needsModelDownload(
  documentDirectory: string,
  previous: RegionPack | null,
  next: RegionPack,
): Promise<boolean> {
  if (previous?.modelUrl !== next.modelUrl) return true;
  // Same URL, new file (a model replaced in place). Packs pinned before checksums existed have none to compare.
  if (previous.modelMd5 !== undefined && previous.modelMd5 !== next.modelMd5) return true;
  try {
    const info = await FileSystem.getInfoAsync(getModelPath(documentDirectory, next.id));
    return !info.exists;
  } catch {
    return true;
  }
}

/** Pure decision: is the installed pack older than what the manifest advertises? */
export function isPackOutdated(
  installedVersion: number | undefined,
  manifestVersion: number | undefined,
): boolean {
  if (typeof manifestVersion !== 'number') return false;
  return (installedVersion ?? 0) < manifestVersion;
}

export type PackUpdate = { id: string; pack: RegionPack };

/**
 * Best-effort boot-time refresh. For each installed region whose manifest
 * version is newer than the installed one, re-download the pack JSON, the
 * model (only if it changed) and the icons, and report it via onUpdated so the store can bump the version and reapply
 * the (possibly reordered) labelMap. No-ops on web / when the filesystem is
 * unavailable. Failures are swallowed per-pack so the stale-but-working pack
 * stays in place.
 */
export async function syncInstalledPacks(opts: {
  installedIds: string[];
  installedVersions: Record<string, number>;
  documentDirectory: string | null;
  onUpdated: (update: PackUpdate) => void;
}): Promise<void> {
  const { installedIds, installedVersions, documentDirectory, onUpdated } = opts;
  if (installedIds.length === 0 || !documentDirectory) return;

  const manifest = await fetchPackManifest();
  if (!manifest) return;

  for (const id of installedIds) {
    const entry = manifest.packs[id];
    if (!entry || !isPackOutdated(installedVersions[id], entry.version)) continue;
    try {
      const pack = await fetchPack(entry.url);
      if (!pack) continue;
      const previous = getPackData(id);
      if (await needsModelDownload(documentDirectory, previous, pack)) {
        await downloadPackModel(documentDirectory, pack);
      }
      await cachePackData(pack); // overwrite cached JSON + merge bugs
      await ensurePackIcons(documentDirectory, pack);
      onUpdated({ id, pack });
    } catch {
      // best-effort: leave the existing installed version untouched
    }
  }
}
