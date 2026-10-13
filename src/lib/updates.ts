/**
 * What "Check for updates" offers: region packs with a newer version in packs/manifest.json.
 * Pure, so Brains and tests share one rule. (The chat model entry went with ADR 009: chat runs
 * on Apple Intelligence, nothing to download.)
 */

export type UpdateManifest = {
  manifest: 1;
  packs: Partial<Record<string, { version: number; url: string }>>;
};

export type Update = { kind: 'pack'; id: string; url: string; version: number };

/** Installed versions: pack id → version. */
export type Installed = { packs: Partial<Record<string, number>> };

export function pendingUpdates(manifest: UpdateManifest | null, installed: Installed): Update[] {
  if (!manifest) return [];
  const out: Update[] = [];
  for (const [id, have] of Object.entries(installed.packs)) {
    const entry = manifest.packs[id];
    if (entry && typeof entry.version === 'number' && entry.version > (have ?? 0)) {
      out.push({ kind: 'pack', id, url: entry.url, version: entry.version });
    }
  }
  return out;
}
