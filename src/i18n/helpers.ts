import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';

import { t, type LangId } from './index';

/**
 * React hook returning a `t()` function bound to the current language.
 * The wrapped function is stable across renders of the same language so
 * it's safe to use in `useMemo`/`useCallback` dependency lists.
 */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const lang = useAppStore((s) => s.language);
  return useMemo(
    () => (key: string, vars?: Record<string, string | number>) => t(lang, key, vars),
    [lang],
  );
}

/**
 * Bug common name lookup. Latin names stay in `src/data/bugs.ts` because
 * they're conventionally Latin everywhere; only the vernacular varies.
 */
export function bugName(lang: LangId, bugId: string): string {
  return t(lang, `bugs.${bugId}.name`);
}

/**
 * Hook variant of `bugName` — re-renders when the language flips.
 */
export function useBugName(bugId: string): string {
  const lang = useAppStore((s) => s.language);
  return useMemo(() => bugName(lang, bugId), [lang, bugId]);
}

/**
 * Country-name lookup for the 2-letter ISO codes stored in profile data.
 * Unknown codes round-trip the code itself rather than throwing.
 */
export function countryName(lang: LangId, code: string): string {
  const v = t(lang, `person.country.${code}`);
  if (v.startsWith('person.country.')) return code;
  return v;
}
