import AsyncStorage from '@react-native-async-storage/async-storage';

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
