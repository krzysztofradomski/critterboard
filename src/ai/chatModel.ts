import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { llamaRnRuntime } from '@/ai/llm';

/**
 * The on-device chat model: Gemma 4 E2B instruct (Apache 2.0), 4-bit GGUF.
 *
 * Chat only works once this file is downloaded and loaded; there is no
 * scripted fallback. Settings downloads/deletes it, Chat reads the status.
 * Web has no llama.rn, so chat is phone-only.
 */
export const CHAT_MODEL = {
  name: 'Gemma 4 E2B',
  filename: 'gemma-4-E2B-it-Q4_K_M.gguf',
  url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
  /** Approximate download size, for the UI. */
  sizeGb: 3.1,
} as const;

/** Earlier chat models whose files are deleted on sight to free space. */
const RETIRED_FILES = ['gemma-3-1b-it-q4_k_m.gguf'];

export type ChatModelStatus =
  | 'unsupported' // web: no on-device runtime
  | 'checking'
  | 'absent'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error';

export type ChatModelState = { status: ChatModelStatus; pct: number };

let _state: ChatModelState = {
  status: Platform.OS === 'web' ? 'unsupported' : 'checking',
  pct: 0,
};
const _listeners = new Set<() => void>();
let _download: FileSystem.DownloadResumable | null = null;

function set(next: Partial<ChatModelState>): void {
  _state = { ..._state, ...next };
  for (const l of _listeners) l();
}

export function chatModelState(): ChatModelState {
  return _state;
}

export function subscribeChatModel(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

function modelsDir(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}models/` : null;
}

export function chatModelPath(): string | null {
  const dir = modelsDir();
  return dir ? `${dir}${CHAT_MODEL.filename}` : null;
}

async function load(path: string): Promise<void> {
  set({ status: 'loading', pct: 100 });
  try {
    await llamaRnRuntime.load(path);
    set({ status: 'ready' });
  } catch {
    set({ status: 'error' });
  }
}

/**
 * Boot/screen-mount check: load the model if its file is on disk, else mark
 * it absent. Also removes retired model files. Safe to call repeatedly.
 */
export async function initChatModel(): Promise<void> {
  const dir = modelsDir();
  const path = chatModelPath();
  if (!dir || !path) return;
  if (_state.status === 'ready' || _state.status === 'loading' || _state.status === 'downloading') {
    return;
  }
  for (const f of RETIRED_FILES) {
    await FileSystem.deleteAsync(`${dir}${f}`, { idempotent: true }).catch(() => undefined);
  }
  try {
    const { exists } = await FileSystem.getInfoAsync(path);
    if (exists) await load(path);
    else set({ status: 'absent', pct: 0 });
  } catch {
    set({ status: 'absent', pct: 0 });
  }
}

/** Download (resumable) and load the model, reporting progress. */
export async function downloadChatModel(): Promise<void> {
  const dir = modelsDir();
  const path = chatModelPath();
  if (!dir || !path) return;
  if (_state.status !== 'absent' && _state.status !== 'error') return;
  set({ status: 'downloading', pct: 0 });
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    _download = FileSystem.createDownloadResumable(
      CHAT_MODEL.url,
      path,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite <= 0) return;
        set({ pct: Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100) });
      },
    );
    const res = await _download.downloadAsync();
    _download = null;
    if (!res || res.status < 200 || res.status >= 300) {
      // e.g. 401/403 if the host starts requiring a login; don't keep the error page.
      await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      set({ status: 'error', pct: 0 });
      return;
    }
    await load(path);
  } catch {
    _download = null;
    set({ status: 'error', pct: 0 });
  }
}

/** Stop a download in progress, unload the model and delete its file. */
export async function deleteChatModel(): Promise<void> {
  const path = chatModelPath();
  await _download?.pauseAsync().catch(() => undefined);
  _download = null;
  await llamaRnRuntime.unload().catch(() => undefined);
  if (path) await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
  set({ status: Platform.OS === 'web' ? 'unsupported' : 'absent', pct: 0 });
}
