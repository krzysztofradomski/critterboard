import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  files: new Set<string>(),
  deleted: [] as string[],
  status: 200,
  loadFails: false,
  loaded: null as string | null,
  mem: 6 * 1024 ** 3 as number | null,
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

vi.mock('expo-device', () => ({
  get totalMemory() {
    return env.mem;
  },
}));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  getInfoAsync: vi.fn(async (p: string) => ({ exists: env.files.has(p) })),
  makeDirectoryAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async (p: string) => {
    env.deleted.push(p);
    env.files.delete(p);
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
      if (env.loadFails) throw new Error('bad gguf');
      env.loaded = p;
    }),
    unload: vi.fn(async () => {
      env.loaded = null;
    }),
  },
}));

const PATH = 'file:///docs/models/gemma-4-E2B-it-Q4_K_M.gguf';

async function fresh() {
  vi.resetModules();
  return import('@/ai/chatModel');
}

describe('chatModel', () => {
  beforeEach(() => {
    env.files.clear();
    env.deleted = [];
    env.status = 200;
    env.loadFails = false;
    env.loaded = null;
    env.mem = 6 * 1024 ** 3;
  });

  it('sorts phones into memory tiers', async () => {
    const { memoryFit } = await fresh();
    const gib = (n: number) => n * 1024 ** 3;
    expect(memoryFit(gib(7.5))).toBe('ok'); // 8 GB phone
    expect(memoryFit(gib(5.6))).toBe('ok'); // 6 GB phone
    expect(memoryFit(gib(3.7))).toBe('confirm'); // 4 GB phone
    expect(memoryFit(gib(2.8))).toBe('tooLittle'); // 3 GB phone
    expect(memoryFit(null)).toBe('confirm'); // unknown
  });

  it('disables chat on phones with too little memory, even if the file is there', async () => {
    env.mem = 2.8 * 1024 ** 3;
    env.files.add(PATH);
    const m = await fresh();
    expect(m.chatModelState()).toMatchObject({ status: 'tooLittleRam', fit: 'tooLittle' });
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('tooLittleRam');
    expect(env.loaded).toBeNull();
    expect(env.files.has(PATH)).toBe(false);
  });

  it('marks 4 GB phones as needing confirmation but still allows the download', async () => {
    env.mem = 3.7 * 1024 ** 3;
    const m = await fresh();
    expect(m.chatModelState().fit).toBe('confirm');
    await m.initChatModel();
    await m.downloadChatModel();
    expect(m.chatModelState().status).toBe('ready');
  });

  it('is absent when the file is not on disk, and removes the retired Gemma 3 file', async () => {
    const m = await fresh();
    await m.initChatModel();
    expect(m.chatModelState().status).toBe('absent');
    expect(env.deleted).toContain('file:///docs/models/gemma-3-1b-it-q4_k_m.gguf');
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
});
