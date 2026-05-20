import { getFallbackPack, getPack } from './registry';
import type { Dict, LangId } from './types';

/**
 * Walk a `foo.bar.baz` dotted path and return the leaf string, or
 * `undefined` if the path doesn't resolve to a string at every step.
 */
function resolve(dict: Dict, path: string): string | undefined {
  const parts = path.split('.');
  let cur: string | string[] | Dict | undefined = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object') {
      // Arrays and objects both index by string; numeric path segments
      // (e.g. `notes.0`) walk array elements transparently.
      if (Array.isArray(cur)) {
        cur = cur[Number(p)];
      } else if (p in cur) {
        cur = (cur as Dict)[p];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

/**
 * Replace `{name}` placeholders in a string with values from `vars`.
 * Missing placeholders are left as-is so the broken slot is visible in
 * QA rather than silently swallowed.
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

/**
 * Translate a key for a given language. Falls back to English on miss, then
 * to the literal key so missing strings show up as `screen.foo.bar` in dev.
 */
export function translateFor(
  lang: LangId,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const primary = resolve(getPack(lang).strings, key);
  if (typeof primary === 'string') return interpolate(primary, vars);
  const fallback = resolve(getFallbackPack().strings, key);
  if (typeof fallback === 'string') return interpolate(fallback, vars);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key: ${key} (lang=${lang})`);
  }
  return key;
}
