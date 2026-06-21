import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { mergeBugs, type Bug } from '@/data/bugs';

export type RegionPack = {
  id: string;
  version: number;
  /** GitHub release asset URL for the .pte model file. */
  modelUrl: string;
  modelVersion: number;
  bugs: Bug[];
  /** scientific name → class index, matching the model's output layer. */
  labelMap: Record<string, number>;
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

async function readCached(id: string): Promise<RegionPack | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as RegionPack;
  } catch {
    return null;
  }
}

export async function cachePackData(pack: RegionPack): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + pack.id, JSON.stringify(pack));
    _packs.set(pack.id, pack);
    mergeBugs(pack.bugs);
  } catch {
    // non-fatal — the pack stays in-memory even if storage write fails
  }
}

export async function removeCachedPack(id: string): Promise<void> {
  try {
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
 */
export async function hydrateInstalledPacks(installedIds: string[]): Promise<void> {
  await Promise.all(
    installedIds.map(async (id) => {
      const pack = await readCached(id);
      if (!pack) return;
      _packs.set(id, pack);
      mergeBugs(pack.bugs);
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

/** Download a pack's .pte model to its on-disk path, reporting 0–100 progress. */
export async function downloadPackModel(
  documentDirectory: string,
  pack: RegionPack,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await FileSystem.makeDirectoryAsync(`${documentDirectory}models/packs/`, {
    intermediates: true,
  });
  const dl = FileSystem.createDownloadResumable(
    pack.modelUrl,
    getModelPath(documentDirectory, pack.id),
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite <= 0) return;
      onProgress?.(Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100));
    },
  );
  await dl.downloadAsync();
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
 * version is newer than the installed one, re-download the pack JSON + model
 * and report it via onUpdated so the store can bump the version and reapply
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
      await cachePackData(pack); // overwrite cached JSON + merge bugs
      await downloadPackModel(documentDirectory, pack);
      onUpdated({ id, pack });
    } catch {
      // best-effort: leave the existing installed version untouched
    }
  }
}
