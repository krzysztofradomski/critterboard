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
  /** Bumped whenever the file changes. */
  version: number;
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
    typeof c.name === 'string' && typeof c.sizeGb === 'number'
  );
}

export function pendingUpdates(manifest: UpdateManifest | null, installed: Installed): Update[] {
  if (!manifest) return [];
  const out: Update[] = [];
  for (const [id, have] of Object.entries(installed.packs)) {
    const entry = manifest.packs[id];
    if (entry && typeof entry.version === 'number' && entry.version > (have ?? 0)) {
      out.push({ kind: 'pack', id, url: entry.url, version: entry.version });
    }
  }
  const chat = manifest.chat;
  if (installed.chat && isChatModelEntry(chat) && chat.version > installed.chat.version) {
    out.push({ kind: 'chat', entry: chat });
  }
  return out;
}
