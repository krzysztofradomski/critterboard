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

// ── Rules on top of the pack facts. Each answers from order, family, genus or the latin name;
// ── they return translation keys so the screen stays language-agnostic.

const genus = (bug: Bug) => bug.latin.split(' ')[0] ?? '';

/** Plain-words name of the species' order ("Butterflies & moths"), or null when unknown. */
export function orderKey(bug: Bug): string | null {
  return bug.facts?.o ? `facts.order.${bug.facts.o}` : null;
}

/**
 * Pests of gardens, crops, forests and homes, by genus or exact latin name. Curated: a family is
 * too coarse (most leaf beetles and moths are harmless). Includes the household species the
 * next pack adds (training/vision/household_species.txt).
 */
const PEST_GENERA = new Set([
  'Aphis', 'Myzus', 'Macrosiphum', 'Brevicoryne', 'Trialeurodes', 'Crioceris', 'Lilioceris', 'Leptinotarsa',
  'Otiorhynchus', 'Cydalima', 'Cameraria', 'Cydia', 'Tineola', 'Plodia', 'Stegobium', 'Anthrenus', 'Blatta',
  'Blattella', 'Periplaneta', 'Cimex', 'Ctenocephalides', 'Monomorium', 'Melolontha', 'Gryllotalpa',
  'Lymantria', 'Thaumetopoea', 'Drosophila', 'Musca', 'Fannia', 'Ostrinia', 'Sitona', 'Hylobius', 'Pyralis',
]);
const PEST_SPECIES = new Set([
  'Pieris brassicae', 'Pieris rapae', 'Euura ribesii', 'Athalia rosae', 'Phyllopertha horticola',
  'Amphimallon solstitiale', 'Tipula oleracea', 'Tipula paludosa', 'Tortrix viridana', 'Vespa velutina',
  'Epiphyas postvittana', 'Archips podana', 'Xanthogaleruca luteola', 'Euproctis chrysorrhoea',
]);

export type Badge = 'pollinator' | 'aphidHunter' | 'hunter' | 'recycler';

/** What the species does for (or to) a garden, as badge keys under `facts.badge.*`. */
export function badges(bug: Bug): Badge[] {
  const d = bug.facts?.d;
  const out: Badge[] = [];
  if (bug.traits.includes('pollinator')) out.push('pollinator');
  if (d === 'aphid_eaters' || d === 'hoverfly') out.push('aphidHunter');
  if (d === 'predator' || d === 'predator_flying' || d === 'spiders') out.push('hunter');
  if (d === 'detritus' || d === 'harvestman' || d === 'scavenge') out.push('recycler');
  return out;
}

/** Garden friend (pollinates or eats pests), pest, or null when neither. Pest wins. */
export function gardenRole(bug: Bug): 'friend' | 'pest' | null {
  if (PEST_SPECIES.has(bug.latin) || PEST_GENERA.has(genus(bug))) return 'pest';
  const helps = badges(bug).some((b) => b !== 'recycler') || bug.facts?.d === 'parasitoid';
  return helps ? 'friend' : null;
}

export type Safety = 'sting' | 'bite' | 'tick' | 'irritant' | 'harmless';

const STING_FAMILIES = new Set(['Vespidae', 'Apidae', 'Pompilidae', 'Mutillidae']);
const BITE_FAMILIES = new Set([
  'Formicidae', 'Culicidae', 'Tabanidae', 'Ceratopogonidae', 'Simuliidae', 'Cimicidae', 'Reduviidae', 'Notonectidae',
]);
const BITE_GENERA = new Set(['Ctenocephalides', 'Stomoxys', 'Cheiracanthium']);
const IRRITANT_GENERA = new Set(['Thaumetopoea', 'Euproctis', 'Sphrageidus', 'Lymantria', 'Paederus']);

/** Is it safe to handle? By family and genus; null when the order is unknown. */
export function safety(bug: Bug): Safety | null {
  const f = bug.facts;
  if (!f?.o) return null;
  const g = genus(bug);
  if (f.o === 'Ixodida') return 'tick';
  if (IRRITANT_GENERA.has(g) || f.fa === 'Meloidae') return 'irritant';
  if (g === 'Myrmica' || (f.fa && STING_FAMILIES.has(f.fa))) return 'sting';
  if (BITE_GENERA.has(g) || (f.fa && BITE_FAMILIES.has(f.fa))) return 'bite';
  return 'harmless';
}

export type LifeCycle = { kind: 'complete' | 'incomplete' | 'direct' | 'mite'; stages: string[] };

const COMPLETE = new Set(['Coleoptera', 'Hymenoptera', 'Diptera', 'Neuroptera', 'Mecoptera', 'Siphonaptera']);
const INCOMPLETE = new Set(['Hemiptera', 'Orthoptera', 'Mantodea', 'Blattodea', 'Dermaptera', 'Psocodea']);
const WATER_NYMPHS = new Set(['Odonata', 'Ephemeroptera', 'Plecoptera']);

/** Life stages from the order, as keys under `facts.stage.*`; null for an order not covered. */
export function lifeCycle(bug: Bug): LifeCycle | null {
  const o = bug.facts?.o;
  if (!o) return null;
  if (o === 'Lepidoptera') return { kind: 'complete', stages: ['egg', 'caterpillar', 'pupa', 'adult'] };
  if (o === 'Trichoptera') return { kind: 'complete', stages: ['egg', 'larvaWater', 'pupa', 'adult'] };
  if (COMPLETE.has(o)) return { kind: 'complete', stages: ['egg', 'larva', 'pupa', 'adult'] };
  if (WATER_NYMPHS.has(o)) return { kind: 'incomplete', stages: ['egg', 'nymphWater', 'adult'] };
  if (INCOMPLETE.has(o)) return { kind: 'incomplete', stages: ['egg', 'nymph', 'adult'] };
  if (o === 'Araneae' || o === 'Opiliones' || o === 'Zygentoma') return { kind: 'direct', stages: ['egg', 'young', 'adult'] };
  if (o === 'Ixodida' || o === 'Trombidiformes') return { kind: 'mite', stages: ['egg', 'larva', 'nymph', 'adult'] };
  return null;
}

/** Everyday objects, mm along their long side, for "about as big as…". */
const SIZE_REFS: Array<[string, number]> = [
  ['sesame', 3], ['rice', 6], ['fingernail', 12], ['coin', 23], ['paperclip', 33], ['matchbox', 50], ['card', 85], ['phone', 150],
];

/** The everyday object closest in size (by ratio) to the species' typical size, or null without one. */
export function sizeComparison(bug: Bug): { ref: string; refMm: number; mm: number } | null {
  const sz = bug.facts?.sz;
  if (!sz) return null;
  const mm = (sz[0] + sz[1]) / 2;
  let best = SIZE_REFS[0]!;
  for (const r of SIZE_REFS) if (Math.abs(Math.log(mm / r[1])) < Math.abs(Math.log(mm / best[1]))) best = r;
  return { ref: best[0], refMm: best[1], mm };
}

/** Records per month, Jan..Dec, 0–9 (relative to the busiest month); null without season data. */
export function seasonLevels(bug: Bug): number[] | null {
  const m = bug.facts?.m;
  return m && /^\d{12}$/.test(m) ? Array.from(m, Number) : null;
}

/**
 * The busiest stretch: the shortest run of months (wrapping over New Year) that holds every month
 * at 5 or more. Returns [first, last] month indexes, 0 = January.
 */
export function peakMonths(levels: number[]): [number, number] | null {
  const hot = levels.map((v, i) => (v >= 5 ? i : -1)).filter((i) => i >= 0);
  if (hot.length === 0) return null;
  let best: [number, number] = [hot[0]!, hot[hot.length - 1]!];
  let bestLen = 12;
  for (const start of hot) {
    const len = Math.max(...hot.map((i) => (i - start + 12) % 12)) + 1;
    if (len < bestLen) {
      bestLen = len;
      best = [start, (start + len - 1) % 12];
    }
  }
  return best;
}

/** Wikipedia's short description in the UI language; no fallback, a foreign paragraph reads as a bug. */
export function aboutText(bug: Bug, lang: LangId): string | null {
  return bug.facts?.ab?.[lang] ?? null;
}
