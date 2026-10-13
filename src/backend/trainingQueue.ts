import AsyncStorage from '@react-native-async-storage/async-storage';

import { isExpired, nextRetryAt, uploadOutcome, type ContributionMeta } from '@/lib/contributions';

/**
 * Photos waiting to be shared for training. Kept on the phone (own storage key) so a scan never
 * waits for the network; useTrainingUploader drains it while Network and "Help train the model"
 * are both on. A sent, refused or expired item is dropped together with its local photo copy.
 */
export type QueueItem = { meta: ContributionMeta; photoUri: string; tries: number; nextAt: number; addedAt: number };

export type QueueDeps = {
  upload: (meta: ContributionMeta, photoUri: string) => Promise<number>;
  fileExists: (uri: string) => Promise<boolean>;
  deleteFile: (uri: string) => Promise<void>;
  now: () => number;
  /** Checked before every upload: false once Network or "Help train the model" is switched off. */
  shouldContinue: () => boolean;
};

const KEY = 'critterboard:training-queue:v1';
/** Species with a photo the server accepted, for the Dex and species-page marker. */
const SHARED_KEY = 'critterboard:training-shared:v1';
const MAX_ITEMS = 300;

let _items: QueueItem[] = [];
let _shared: string[] = [];
let _loading: Promise<void> | null = null;
let _running = false;
const _listeners = new Set<() => void>();

function emit(): void {
  for (const l of _listeners) l();
}

async function save(): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(_items)).catch(() => undefined);
  emit();
}

async function saveShared(): Promise<void> {
  await AsyncStorage.setItem(SHARED_KEY, JSON.stringify(_shared)).catch(() => undefined);
  emit();
}

/** Read the stored queue once; every caller waits for the same read, so nothing queued meanwhile is lost. */
export function loadQueue(): Promise<void> {
  _loading ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) _items = parsed.filter((x) => x && typeof x.photoUri === 'string' && x.meta?.id);
    } catch {
      _items = [];
    }
    try {
      const raw = await AsyncStorage.getItem(SHARED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) _shared = parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      _shared = [];
    }
    emit();
  })();
  return _loading;
}

export function queueItems(): QueueItem[] {
  return _items;
}

/** Species with a photo already shared for training (kept until forgotten below). */
export function sharedBugIds(): string[] {
  return _shared;
}

/**
 * Forget the shared marks: one species (removed from the Dex) or all of them (shared photos
 * deleted on the server, online data deleted, app wiped).
 */
export async function forgetShared(bugId?: string): Promise<void> {
  await loadQueue();
  _shared = bugId ? _shared.filter((b) => b !== bugId) : [];
  await saveShared();
}

export function subscribeQueue(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export async function enqueueContribution(meta: ContributionMeta, photoUri: string, now = Date.now()): Promise<void> {
  await loadQueue();
  if (_items.some((i) => i.meta.id === meta.id)) return;
  _items = [..._items, { meta, photoUri, tries: 0, nextAt: now, addedAt: now }].slice(-MAX_ITEMS);
  await save();
}

/** Empty the queue (Delete my shared photos, Wipe everything), deleting the local copies. */
export async function clearQueue(deleteFile: (uri: string) => Promise<void>): Promise<void> {
  await loadQueue();
  const uris = _items.map((i) => i.photoUri);
  _items = [];
  await save();
  for (const u of uris) await deleteFile(u).catch(() => undefined);
}

/** One pass over the due items, one upload at a time. Returns how many were sent. */
export async function processQueue(deps: QueueDeps): Promise<{ sent: number }> {
  await loadQueue();
  if (_running) return { sent: 0 };
  _running = true;
  let sent = 0;
  try {
    for (const item of [..._items]) {
      if (!deps.shouldContinue()) break;
      const now = deps.now();
      if (item.nextAt > now) continue;
      const drop = async () => {
        _items = _items.filter((i) => i.meta.id !== item.meta.id);
        await deps.deleteFile(item.photoUri).catch(() => undefined);
        await save();
      };
      if (isExpired(item, now) || !(await deps.fileExists(item.photoUri))) {
        await drop();
        continue;
      }
      const outcome = uploadOutcome(await deps.upload(item.meta, item.photoUri).catch(() => 0));
      if (outcome === 'done') {
        sent += 1;
        if (!_shared.includes(item.meta.bug_id)) {
          _shared = [..._shared, item.meta.bug_id];
          await saveShared();
        }
      }
      if (outcome === 'retry') {
        _items = _items.map((i) =>
          i.meta.id === item.meta.id ? { ...i, tries: i.tries + 1, nextAt: nextRetryAt(i.tries, now) } : i,
        );
        await save();
      } else {
        await drop();
      }
    }
  } finally {
    _running = false;
  }
  return { sent };
}
