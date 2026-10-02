import { describe, expect, it } from 'vitest';

import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';
import es from '../../../../assets/i18n/es.json';
import pl from '../../../../assets/i18n/pl.json';

type Tree = { [k: string]: string | string[] | Tree };

function flatten(o: Tree, prefix = ''): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || Array.isArray(v)) out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const base = flatten(en.strings as Tree);
const placeholders = (v: string | string[]) =>
  [...JSON.stringify(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each([
  ['de', de],
  ['es', es],
  ['pl', pl],
])('%s translations', (_lang, pack) => {
  const strings = flatten(pack.strings as Tree);

  it('has every key the English pack has', () => {
    expect(Object.keys(base).filter((k) => !(k in strings))).toEqual([]);
  });

  it('has no leftover keys English dropped', () => {
    expect(Object.keys(strings).filter((k) => !(k in base))).toEqual([]);
  });

  it('keeps the same {placeholders} as English', () => {
    const bad = Object.keys(base).filter(
      (k) => k in strings && placeholders(base[k]!).join() !== placeholders(strings[k]!).join(),
    );
    expect(bad).toEqual([]);
  });
});
