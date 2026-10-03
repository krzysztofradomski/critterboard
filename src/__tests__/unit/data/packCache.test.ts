import { vi, describe, it, expect } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A device with a document directory: packs live in files, old AsyncStorage copies move over.
const files = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  getInfoAsync: vi.fn(async (p: string) => ({ exists: files.has(p) })),
  readAsStringAsync: vi.fn(async (p: string) => files.get(p)),
  writeAsStringAsync: vi.fn(async (p: string, s: string) => void files.set(p, s)),
  moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    files.set(to, files.get(from)!);
    files.delete(from);
  }),
  deleteAsync: vi.fn(async (p: string) => void files.delete(p)),
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/data/bugIcons', () => ({ ensurePackIcons: vi.fn().mockResolvedValue(false) }));

import { getPackData, hydrateInstalledPacks } from '@/data/regionPacks';

describe('region pack cache', () => {
  it('moves a pack stored in AsyncStorage into a file, then reads the file', async () => {
    const pack = { id: 'xx', version: 3, modelUrl: '', modelVersion: 1, bugs: [], labelMap: {} };
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(JSON.stringify(pack));

    await hydrateInstalledPacks(['xx']);

    expect(getPackData('xx')?.version).toBe(3);
    expect(JSON.parse(files.get('file:///doc/packs/xx.json')!).version).toBe(3);
    expect(files.has('file:///doc/packs/xx.json.part')).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('critterboard:regionpack:xx');

    // Second launch: straight from the file, AsyncStorage is not asked.
    vi.mocked(AsyncStorage.getItem).mockClear();
    await hydrateInstalledPacks(['xx']);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(getPackData('xx')?.version).toBe(3);
  });
});
