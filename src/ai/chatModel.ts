import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { llamaRnRuntime } from '@/ai/llm';
import { downloadFile } from '@/lib/download';

/**
 * The on-device chat model: Qwen3 1.7B instruct (Apache 2.0), 4-bit GGUF (ADR 008).
 *
 * Chat only works once this file is downloaded and loaded; there is no
 * scripted fallback. Settings downloads/deletes it, Chat reads the status.
 * Web has no llama.rn, so chat is phone-only. The model needs about 1.5 GB of
 * RAM: 4 GB phones download it directly, 3 GB phones must confirm first, and
 * smaller phones can't use chat (see memoryFit).
 */
export const CHAT_MODEL = {
  name: 'Qwen3 1.7B',
  filename: 'Qwen3-1.7B-Q4_K_M.gguf',
  /**
   * Pinned to a repo commit, not `main`: a third-party repo could otherwise swap the file
   * the app hands to llama.cpp at any time. To update, take the new commit `sha` and the
   * file's `size` from https://huggingface.co/api/models/unsloth/Qwen3-1.7B-GGUF/revision/main?blobs=true
   */
  url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/d7f544eead698dbd1f15126ef60b45a1e1933222/Qwen3-1.7B-Q4_K_M.gguf',
  /** Exact size at that commit; a download of any other size is discarded. */
  bytes: 1_107_409_472,
  /** Approximate download size, for the UI. */
  sizeGb: 1.1,
} as const;

/** Earlier chat models whose files are deleted on sight to free space. */
const RETIRED_FILES = ['gemma-3-1b-it-q4_k_m.gguf', 'gemma-4-E2B-it-Q4_K_M.gguf'];

/**
 * How well the phone's memory fits Qwen3 1.7B (~1.5 GB while loaded, 4k context).
 * Phones report a little less than their marketed RAM (a "4 GB" iPhone
 * reports about 3.6–3.9 GiB), hence the thresholds below the round numbers.
 */
export type MemoryFit = 'ok' | 'confirm' | 'tooLittle';

export function memoryFit(totalBytes: number | null | undefined): MemoryFit {
  if (totalBytes == null) return 'confirm'; // unknown: let the user decide
  const gib = totalBytes / 1024 ** 3;
  if (gib >= 3.3) return 'ok'; // 4 GB class and up
  if (gib >= 2.4) return 'confirm'; // 3 GB class
  return 'tooLittle';
}

export type ChatModelStatus =
  | 'unsupported' // web: no on-device runtime
  | 'tooLittleRam' // phone with less than ~4 GB of RAM
  | 'checking'
  | 'absent'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'ejected' // file on disk, unloaded from memory by the user
  | 'error';

export type ChatModelState = { status: ChatModelStatus; pct: number; fit: MemoryFit };

const FIT: MemoryFit = memoryFit(Device.totalMemory);

function idleStatus(): ChatModelStatus {
  if (Platform.OS === 'web') return 'unsupported';
  return FIT === 'tooLittle' ? 'tooLittleRam' : 'absent';
}

let _state: ChatModelState = {
  status: Platform.OS === 'web' || FIT === 'tooLittle' ? idleStatus() : 'checking',
  pct: 0,
  fit: FIT,
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
  if (
    _state.status === 'ready' ||
    _state.status === 'loading' ||
    _state.status === 'downloading' ||
    _state.status === 'ejected' // stays out of memory until the user loads it
  ) {
    return;
  }
  if (FIT === 'tooLittle') {
    // Not enough memory to load it; delete a file left from a restored backup.
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    set({ status: 'tooLittleRam', pct: 0 });
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

/**
 * Download (resumable) and load the model, reporting progress. On a 4 GB
 * phone (`fit === 'confirm'`) the caller must have asked the user first.
 */
export async function downloadChatModel(): Promise<void> {
  const dir = modelsDir();
  const path = chatModelPath();
  if (!dir || !path || FIT === 'tooLittle') return;
  if (_state.status !== 'absent' && _state.status !== 'error') return;
  set({ status: 'downloading', pct: 0 });
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    // Throws on a non-2xx answer (e.g. a login page), a wrong size or a cancel; nothing is kept then.
    await downloadFile(CHAT_MODEL.url, path, {
      expect: { bytes: CHAT_MODEL.bytes },
      onProgress: (pct) => set({ pct }),
      onStart: (dl) => (_download = dl),
    });
    _download = null;
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
  set({ status: idleStatus(), pct: 0 });
}

/** Free the model's ~3 GB of RAM but keep the file; `loadChatModel` brings it back. */
export async function ejectChatModel(): Promise<void> {
  if (_state.status !== 'ready') return;
  await llamaRnRuntime.unload().catch(() => undefined);
  set({ status: 'ejected', pct: 0 });
}

/** Load a downloaded model that was ejected (or failed to load). */
export async function loadChatModel(): Promise<void> {
  const path = chatModelPath();
  if (!path || (_state.status !== 'ejected' && _state.status !== 'error')) return;
  await load(path);
}
