/**
 * What "Check for updates" offers: region packs with a newer version in packs/manifest.json,
 * and a newer chat model. Pure, so Brains and tests share one rule.
 */

/** A downloadable chat model, as listed in packs/manifest.json → `chat`. */
export type ChatModelEntry = {
  id: string;
  name: string;
  filename: string;
  /** Pinned download URL (a repo commit, never `main`). */
  url: string;
  /** Exact size; a download of any other size is discarded. */
  bytes: number;
  /** Approximate size, for the UI. */
  sizeGb: number;
  /** Bumped whenever the file changes (with a new filename, so the old file is never overwritten). */
  version: number;
  /** Phones reporting less RAM than this (GiB) aren't offered it. */
  minRamGb?: number;
};

export type UpdateManifest = {
  manifest: 1;
  packs: Partial<Record<string, { version: number; url: string }>>;
  chat?: ChatModelEntry;
};

export type Update =
  | { kind: 'pack'; id: string; url: string; version: number }
  | { kind: 'chat'; entry: ChatModelEntry };

/** Installed versions: pack id → version, and the downloaded chat model (null if none). */
export type Installed = { packs: Partial<Record<string, number>>; chat: { version: number } | null };

export function isChatModelEntry(e: unknown): e is ChatModelEntry {
  const c = e as ChatModelEntry | null;
  return (
    !!c &&
    typeof c.filename === 'string' && /^[\w.-]+\.gguf$/.test(c.filename) &&
    typeof c.url === 'string' && c.url.startsWith('https://') &&
    Number.isInteger(c.bytes) && c.bytes > 0 &&
    Number.isInteger(c.version) && c.version > 0 &&
    typeof c.name === 'string' && typeof c.sizeGb === 'number' &&
    (c.minRamGb === undefined || (typeof c.minRamGb === 'number' && c.minRamGb > 0))
  );
}

/** `ramGb`: this phone's memory (GiB), to skip a chat model it can't run; null when unknown. */
export function pendingUpdates(manifest: UpdateManifest | null, installed: Installed, ramGb: number | null = null): Update[] {
  if (!manifest) return [];
  const out: Update[] = [];
  for (const [id, have] of Object.entries(installed.packs)) {
    const entry = manifest.packs[id];
    if (entry && typeof entry.version === 'number' && entry.version > (have ?? 0)) {
      out.push({ kind: 'pack', id, url: entry.url, version: entry.version });
    }
  }
  const chat = manifest.chat;
  const fits = (c: ChatModelEntry) => !c.minRamGb || ramGb === null || ramGb >= c.minRamGb;
  if (installed.chat && isChatModelEntry(chat) && chat.version > installed.chat.version && fits(chat)) {
    out.push({ kind: 'chat', entry: chat });
  }
  return out;
}

/**
 * Which chat model to use at start: the one saved by an update if it's at least as new as the
 * app's compiled one; otherwise the compiled one, and the older saved file is stale (to delete,
 * unless it is the compiled file itself).
 */
export function pickActiveChatModel(
  saved: unknown,
  compiled: ChatModelEntry,
): { active: ChatModelEntry; staleFile: string | null } {
  if (!isChatModelEntry(saved)) return { active: compiled, staleFile: null };
  if (saved.version >= compiled.version) return { active: saved, staleFile: null };
  return { active: compiled, staleFile: saved.filename === compiled.filename ? null : saved.filename };
}
