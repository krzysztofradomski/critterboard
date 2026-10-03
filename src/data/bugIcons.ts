import * as FileSystem from 'expo-file-system/legacy';

import { downloadFile } from '@/lib/download';

/**
 * Photo-based sticker icons for pack species.
 *
 * A pack ships all its icons as one atlas file (concatenated WebP images)
 * plus an index of byte ranges in the pack JSON. On install the atlas is
 * downloaded once and split into `icons/<packId>/<bugId>.webp`, so screens
 * can load each icon as a plain file URI. A `.v<version>` marker file says
 * the split finished; a newer icon version replaces the whole folder.
 *
 * Species without an icon (bundled-only species, web preview, failed
 * download) fall back to their emoji; see `BugIcon`.
 */
export type PackIcons = {
  /** Atlas URL (concatenated .webp files). */
  url: string;
  version: number;
  /** bug id → [byte offset, byte length] in the atlas. */
  index: Record<string, [number, number]>;
  /** Pinned size and MD5 of the atlas (tools/packs/pin_checksums.py). */
  bytes?: number;
  md5?: string;
};

// bug id → file URI. Replaced (not mutated) on change so React can compare it.
let _icons: ReadonlyMap<string, string> = new Map();
const _listeners = new Set<() => void>();

function publish(next: Map<string, string>): void {
  _icons = next;
  for (const l of _listeners) l();
}

export function bugIconUri(id: string): string | undefined {
  return _icons.get(id);
}

export function allBugIcons(): ReadonlyMap<string, string> {
  return _icons;
}

export function subscribeBugIcons(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export function iconDir(documentDirectory: string, packId: string): string {
  return `${documentDirectory}icons/${packId}/`;
}

function register(dir: string, ids: string[]): void {
  const next = new Map(_icons);
  for (const id of ids) next.set(id, `${dir}${id}.webp`);
  publish(next);
}

function unregister(dir: string): void {
  const next = new Map([..._icons].filter(([, uri]) => !uri.startsWith(dir)));
  publish(next);
}

/** Ids come from the downloaded pack and become file names: plain species ids only, never a path. */
const ICON_ID_RE = /^[a-z0-9-]{1,64}$/;

/**
 * Make a pack's icons available: register them if this icon version is
 * already on disk, otherwise download the atlas and split it. Best-effort:
 * returns false (and leaves the emoji fallback) on any failure.
 */
export async function ensurePackIcons(
  documentDirectory: string | null,
  pack: { id: string; icons?: PackIcons },
): Promise<boolean> {
  const icons = pack.icons;
  if (!documentDirectory || !icons) return false;
  const dir = iconDir(documentDirectory, pack.id);
  const marker = `${dir}.v${icons.version}`;
  try {
    if (!(await FileSystem.getInfoAsync(marker)).exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const atlas = `${dir}atlas.bin`;
      await downloadFile(icons.url, atlas, { expect: { bytes: icons.bytes, md5: icons.md5 } });
      const entries = Object.entries(icons.index).filter(([id]) => ICON_ID_RE.test(id));
      // Small batches: each slice is a native read + write of a few KB.
      for (let i = 0; i < entries.length; i += 16) {
        await Promise.all(
          entries.slice(i, i + 16).map(async ([id, [position, length]]) => {
            const b64 = await FileSystem.readAsStringAsync(atlas, {
              encoding: FileSystem.EncodingType.Base64,
              position,
              length,
            });
            await FileSystem.writeAsStringAsync(`${dir}${id}.webp`, b64, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }),
        );
      }
      await FileSystem.deleteAsync(atlas, { idempotent: true });
      await FileSystem.writeAsStringAsync(marker, '');
    }
    register(dir, Object.keys(icons.index).filter((id) => ICON_ID_RE.test(id)));
    return true;
  } catch {
    unregister(dir);
    return false;
  }
}

/** Delete a pack's icons (on uninstall). */
export async function removePackIcons(
  documentDirectory: string | null,
  packId: string,
): Promise<void> {
  if (!documentDirectory) return;
  const dir = iconDir(documentDirectory, packId);
  unregister(dir);
  await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => undefined);
}
