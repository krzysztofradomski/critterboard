import AsyncStorage from '@react-native-async-storage/async-storage';

import { registerPack } from './registry';
import type { LangId, Pack, RemotePackManifest } from './types';

/**
 * Where to fetch the pack manifest from. `null` disables OTA pack loading;
 * set it to a public URL (CDN, GitHub raw, your own host) to enable it. The
 * manifest schema is documented in `docs/i18n.md`.
 *
 * Kept as a module-level mutable so test code can flip it at runtime.
 */
export let PACK_MANIFEST_URL: string | null = null;

export function setPackManifestUrl(url: string | null): void {
  PACK_MANIFEST_URL = url;
}

const STORAGE_PREFIX = 'critterboard:i18n:pack:';

type CachedPack = { pack: Pack; version: number };

async function readCached(lang: LangId): Promise<CachedPack | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + lang);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPack;
  } catch {
    return null;
  }
}

async function writeCached(lang: LangId, pack: Pack): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_PREFIX + lang,
      JSON.stringify({ pack, version: pack.version }),
    );
  } catch {
    /* swallow — cache write failures are non-fatal */
  }
}

/**
 * On boot, replay any cached remote packs into the in-memory registry so the
 * UI shows the newest strings the user has ever fetched, even when offline.
 * Safe to call multiple times — registry just re-registers identical packs.
 */
export async function hydrateCachedPacks(langs: LangId[]): Promise<void> {
  await Promise.all(
    langs.map(async (lang) => {
      const cached = await readCached(lang);
      if (cached?.pack) registerPack(cached.pack);
    }),
  );
}

/**
 * Best-effort check for newer translation packs. Silently no-ops if the URL
 * is unset, the network is down, the manifest is malformed, or a single
 * pack download fails — translations always have a working bundled
 * fallback, so this is purely additive.
 */
export async function syncRemotePacks(): Promise<void> {
  if (!PACK_MANIFEST_URL) return;
  try {
    const res = await fetch(PACK_MANIFEST_URL, { method: 'GET' });
    if (!res.ok) return;
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return;
    const manifest = (await res.json()) as RemotePackManifest;
    if (manifest.manifest !== 1) return;
    await Promise.all(
      (Object.entries(manifest.packs) as Array<[LangId, { version: number; url: string }]>)
        .map(async ([lang, entry]) => {
          if (!entry?.url) return;
          const cached = await readCached(lang);
          if (cached && cached.version >= entry.version) return;
          try {
            const pr = await fetch(entry.url);
            if (!pr.ok) return;
            if (!(pr.headers.get('content-type') ?? '').includes('application/json')) return;
            const pack = (await pr.json()) as Pack;
            if (pack.lang !== lang) return;
            registerPack(pack);
            await writeCached(lang, pack);
          } catch {
            /* one pack failing doesn't block the others */
          }
        }),
    );
  } catch {
    /* network errors are fine — bundled packs remain in effect */
  }
}
