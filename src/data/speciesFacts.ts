import type { Bug } from '@/data/bugs';
import type { LangId } from '@/i18n';
import { PB } from '@/tokens/pb';

export type FactTile = { label: string; value: string; color: string };

type T = (key: string, vars?: Record<string, string | number>) => string;

/** "24–28 mm" under 3 cm, "3.5–4.2 cm" above; decimal comma outside English. */
export function formatSize(sz: [number, number], lang: LangId): string {
  const [lo, hi] = sz;
  const useCm = hi >= 30;
  const n = (mm: number) => {
    const v = useCm ? mm / 10 : mm;
    const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
    return lang === 'en' ? s : s.replace('.', ',');
  };
  const unit = useCm ? 'cm' : 'mm';
  return lo === hi ? `${n(lo)} ${unit}` : `${n(lo)}–${n(hi)} ${unit}`;
}

/**
 * The four educational tiles for a pack species: habitat, size (or family when no size is
 * known), range and diet. Habitat and diet are typical for the species' family; see
 * tools/facts/build_facts.py for where each value comes from.
 */
export function factTiles(bug: Bug, lang: LangId, t: T): FactTile[] | null {
  const f = bug.facts;
  if (!f) return null;
  const unknown = t('facts.unknown');
  const sizeTile: FactTile = f.sz
    ? { label: t(f.k === 'w' ? 'facts.wingspan' : 'facts.size'), value: formatSize(f.sz, lang), color: PB.blue }
    : { label: t('facts.family'), value: f.fa ?? unknown, color: PB.blue };
  return [
    { label: t('facts.habitat'), value: f.h ? t(`facts.habitatOf.${f.h}`) : unknown, color: PB.green },
    sizeTile,
    {
      label: t('facts.range'),
      value: f.r?.length ? f.r.map((r) => t(`facts.region.${r}`)).join(', ') : unknown,
      color: PB.purple,
    },
    { label: t('facts.diet'), value: f.d ? t(`facts.dietOf.${f.d}`) : unknown, color: PB.red },
  ];
}

/** Wikipedia article (or its search page) for the species, in the UI language. */
export function wikipediaUrl(bug: Bug, lang: LangId): string {
  return `https://${lang}.wikipedia.org/w/index.php?search=${encodeURIComponent(bug.latin)}`;
}
