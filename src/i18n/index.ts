import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { subscribePacks } from './registry';
import { translateFor } from './translate';
import { DEFAULT_LANG, LANG_META, type LangId } from './types';

export { LANG_META, DEFAULT_LANG } from './types';
export type { LangId, Pack, RemotePackManifest } from './types';
export { hydrateCachedPacks, syncRemotePacks, setPackManifestUrl } from './loader';

/**
 * Imperative translator for use outside React (data files, persona
 * helpers, store actions). Pass the current language explicitly — there is
 * no implicit global "current" language here, because that would couple
 * non-React code to the React store.
 */
export function t(
  lang: LangId,
  key: string,
  vars?: Record<string, string | number>,
): string {
  return translateFor(lang, key, vars);
}

/**
 * React hook variant: returns a memoized `t` bound to the active language,
 * and re-renders subscribers when a remote pack update lands.
 */
export function useT(lang: LangId): (key: string, vars?: Record<string, string | number>) => string {
  // useSyncExternalStore gives us cheap, opt-in re-renders when the registry
  // swaps in a remote pack for the lang we're currently displaying.
  const version = useSyncExternalStore(
    useCallback((cb) => subscribePacks(cb), []),
    () => packVersionStamp,
    () => packVersionStamp,
  );
  return useMemo(
    () => (key: string, vars?: Record<string, string | number>) => translateFor(lang, key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, version],
  );
}

// Monotonic stamp bumped any time a pack is replaced — lets the hook above
// distinguish "registry changed" from "registry unchanged" without diffing.
let packVersionStamp = 0;
subscribePacks(() => {
  packVersionStamp += 1;
});

export function isKnownLang(value: string): value is LangId {
  return LANG_META.some((m) => m.id === value);
}

export function coerceLang(value: string | null | undefined): LangId {
  if (value && isKnownLang(value)) return value;
  return DEFAULT_LANG;
}
