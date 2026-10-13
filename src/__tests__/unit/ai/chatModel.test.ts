import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  files: new Set<string>(),
  deleted: [] as string[],
  status: 200,
  size: 1_107_409_472,
  loadFails: false,
  loaded: null as string | null,
  mem: 6 * 1024 ** 3 as number | null,
  json: new Map<string, string>(),
  failPath: null as string | null,
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('expo-device', () => ({
  get totalMemory() {
    return env.mem;
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: vi.fn(async (p: string) => ({ exists: env.files.has(p), size: env.size })),
  makeDirectoryAsync: vi.fn(async () => undefined),
  readAsStringAsync: vi.fn(async (p: string) => {
    const v = env.json.get(p);
    if (v === undefined) throw new Error('no file');
    return v;
  }),
  writeAsStringAsync: vi.fn(async (p: string, v: string) => {
    env.json.set(p, v);
  }),
  deleteAsync: vi.fn(async (p: string) => {
    env.deleted.push(p);
    env.files.delete(p);
  }),
  moveAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    env.files.delete(from);
    env.files.add(to);
  }),
  createDownloadResumable: vi.fn(
    (_url: string, path: string, _o: unknown, onProgress: (p: object) => void) => ({
      downloadAsync: vi.fn(async () => {
        onProgress({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
        env.files.add(path);
        return { status: env.status };
      }),
      pauseAsync: vi.fn(async () => undefined),
    }),
  ),
}));

vi.mock('@/ai/llm', () => ({
  llamaRnRuntime: {
    load: vi.fn(async (p: string) => {
      if (env.loadFails || p === env.failPath) throw new Error('bad gguf');
      env.loaded = p;
    }),
    unload: vi.fn(async () => {
      env.loaded = null;
    }),
  },
}));

const PATH = 'file:///docs/models/Qwen3-1.7B-Q4_K_M.gguf';

async function fresh() {
  vi.resetModules();
  return import('@/ai/chatModel');
}

describe('chatModel', () => {
  beforeEach(() => {
    env.files.clear();
    env.deleted = [];
    env.status = 200;
    env.size = 1_107_409_472;
    env.loadFails = false;
    env.loaded = null;
    env.mem = 6 * 1024 ** 3;
    env.json.clear();
    env.failPath = null;
  });

  it('discards a download of the wrong size (cut off, or not the pinned file)', async () => {
    env.size = 1_000;
    const m = await fresh();
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('error');
    expect(env.files.size).toBe(0);
    expect(env.loaded).toBeNull();
  });

  it('sorts phones into memory tiers', async () => {
    const { memoryFit } = await fresh();
    const gib = (n: number) => n * 1024 ** 3;
    expect(memoryFit(gib(7.5))).toBe('ok'); // 8 GB phone
    expect(memoryFit(gib(5.6))).toBe('ok'); // 6 GB phone
    expect(memoryFit(gib(3.7))).toBe('ok'); // 4 GB phone (iPhone 13 mini): Qwen3 1.7B needs ~1.5 GB
    expect(memoryFit(gib(2.8))).toBe('confirm'); // 3 GB phone
    expect(memoryFit(gib(1.8))).toBe('tooLittle'); // 2 GB phone
    expect(memoryFit(null)).toBe('confirm'); // unknown
  });

  it('disables chat on phones with too little memory, even if the file is there', async () => {
    env.mem = 1.8 * 1024 ** 3;
    env.files.add(PATH);
    const m = await fresh();
    expect(m.chatModelState()).toMatchObject({ status: 'tooLittleRam', fit: 'tooLittle' });
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('tooLittleRam');
    expect(env.loaded).toBeNull();
    expect(env.files.has(PATH)).toBe(false);
  });

  it('marks 3 GB phones as needing confirmation but still allows the download', async () => {
    env.mem = 2.8 * 1024 ** 3;
    const m = await fresh();
    expect(m.chatModelState().fit).toBe('confirm');
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('ready');
  });

  it('is absent when the file is not on disk, and removes the retired Gemma files', async () => {
    const m = await fresh();
    await m.initChatModel();
    expect(m.chatModelState().status).toBe('absent');
    expect(env.deleted).toContain('file:///docs/models/gemma-3-1b-it-q4_k_m.gguf');
    expect(env.deleted).toContain('file:///docs/models/gemma-4-E2B-it-Q4_K_M.gguf');
  });

  it('loads a model already on disk', async () => {
    env.files.add(PATH);
    const m = await fresh();
    await m.initChatModel();
    expect(m.chatModelState().status).toBe('ready');
    expect(env.loaded).toBe(PATH);
  });

  it('downloads, reports progress and loads', async () => {
    const m = await fresh();
    await m.initChatModel();
    const seen: number[] = [];
    m.subscribeChatModel(() => seen.push(m.chatModelState().pct));
    await m.downloadChatModel();
    expect(seen).toContain(50);
    expect(m.chatModelState().status).toBe('ready');
  });

  it('treats a non-2xx download (e.g. a login page) as an error and deletes the file', async () => {
    env.status = 401;
    const m = await fresh();
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('error');
    expect(env.files.has(PATH)).toBe(false);
  });

  it('reports an error when the file does not load', async () => {
    env.loadFails = true;
    const m = await fresh();
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('error');
  });

  it('delete unloads the model and removes the file', async () => {
    env.files.add(PATH);
    const m = await fresh();
    await m.initChatModel();
    await m.deleteChatModel();
    expect(env.loaded).toBeNull();
    expect(env.files.has(PATH)).toBe(false);
    expect(m.chatModelState().status).toBe('absent');
  });

  it('eject frees memory but keeps the file, init does not reload it, load brings it back', async () => {
    env.files.add(PATH);
    const m = await fresh();
    await m.initChatModel();
    await m.ejectChatModel();
    expect(env.loaded).toBeNull();
    expect(env.files.has(PATH)).toBe(true);
    expect(m.chatModelState().status).toBe('ejected');
    await m.initChatModel();
    expect(m.chatModelState().status).toBe('ejected');
    await m.loadChatModel();
    expect(m.chatModelState().status).toBe('ready');
  });

  const V2 = 'file:///docs/models/Qwen3-1.7B-v2.gguf';
  const entryV2 = () => ({
    id: 'chat', name: 'Qwen3 1.7B', filename: 'Qwen3-1.7B-v2.gguf',
    url: 'https://example.com/v2.gguf', bytes: env.size, sizeGb: 1.1, version: 2,
  });

  it('reports the downloaded model as installed, with its version', async () => {
    const m = await fresh();
    await m.initChatModel();
    expect(m.installedChatModel()).toBeNull();
    env.files.add(PATH);
    const m2 = await fresh();
    await m2.initChatModel();
    expect(m2.installedChatModel()).toEqual({ version: 1 });
  });

  it('updates to a newer model: new file in, old file out, and it sticks after a restart', async () => {
    env.files.add(PATH);
    const m = await fresh();
    await m.initChatModel();
    expect(await m.updateChatModel(entryV2())).toBe(true);
    expect(env.files.has(V2)).toBe(true);
    expect(env.files.has(PATH)).toBe(false);
    expect(env.loaded).toBe(V2);
    expect(m.activeChatModel().version).toBe(2);
    expect(m.chatModelState()).toMatchObject({ status: 'ready', updatePct: null });

    const again = await fresh();
    await again.initChatModel();
    expect(again.activeChatModel().version).toBe(2);
    expect(env.loaded).toBe(V2);
  });

  it('a failed update keeps the old model loaded and in use', async () => {
    env.files.add(PATH);
    const m = await fresh();
    await m.initChatModel();
    env.status = 500;
    expect(await m.updateChatModel(entryV2())).toBe(false);
    expect(env.files.has(PATH)).toBe(true);
    expect(env.files.has(V2)).toBe(false);
    expect(env.loaded).toBe(PATH);
    expect(m.activeChatModel().version).toBe(1);
    expect(m.chatModelState()).toMatchObject({ status: 'ready', updatePct: null });
  });

  it('a new model that will not load is removed and the old one keeps working', async () => {
    env.files.add(PATH);
    const m = await fresh();
    await m.initChatModel();
    env.failPath = V2;
    expect(await m.updateChatModel(entryV2())).toBe(false);
    expect(env.files.has(PATH)).toBe(true);
    expect(env.files.has(V2)).toBe(false);
    expect(env.loaded).toBe(PATH);
    expect(m.activeChatModel().version).toBe(1);
    expect(m.chatModelState().status).toBe('ready');
  });

  it('skips an update that needs more memory than this phone has', async () => {
    env.files.add(PATH);
    env.mem = 6 * 1024 ** 3;
    const m = await fresh();
    await m.initChatModel();
    expect(await m.updateChatModel({ ...entryV2(), minRamGb: 8 })).toBe(false);
    expect(env.files.has(V2)).toBe(false);
    expect(env.loaded).toBe(PATH);
  });
});
