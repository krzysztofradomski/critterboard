import type { Bug } from '@/data/bugs';

/**
 * "Name it yourself" search over the region pack's species: the app-language name, the
 * English name and the Latin name, ignoring case and accents. Pure; the caller passes how
 * a species is named in the current language (`bugName`).
 */

const RARITY_ORDER: Record<Bug['rarity'], number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

/** Lowercase, accents off. ł and ß don't decompose under NFD, so they are mapped by hand. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** 0: a name starts with the query; 1: a word in it does; 2: it's somewhere inside; null: no match. */
function rank(fields: string[], q: string): number | null {
  let best: number | null = null;
  for (const f of fields) {
    const r = f.startsWith(q) ? 0 : f.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q)) ? 1 : f.includes(q) ? 2 : null;
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

export function searchSpecies(bugs: readonly Bug[], query: string, nameOf: (b: Bug) => string): Bug[] {
  const q = fold(query.trim());
  if (!q) return [];
  const hits: { bug: Bug; r: number; name: string }[] = [];
  for (const bug of bugs) {
    const name = nameOf(bug);
    const r = rank([fold(name), fold(bug.name), fold(bug.latin)], q);
    if (r !== null) hits.push({ bug, r, name });
  }
  hits.sort((a, b) => a.r - b.r || RARITY_ORDER[a.bug.rarity] - RARITY_ORDER[b.bug.rarity] || a.name.localeCompare(b.name));
  return hits.map((h) => h.bug);
}
