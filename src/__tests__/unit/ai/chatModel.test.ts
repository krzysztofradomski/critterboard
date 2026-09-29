import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  files: new Set<string>(),
  deleted: [] as string[],
  status: 200,
  loadFails: false,
  loaded: null as string | null,
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

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
