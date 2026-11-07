import type { LangId } from '@/i18n/types';
import type { CatchEvent } from '@/lib/streak';

export type DexSort = 'date' | 'name';

/** Sort registry-ordered entries while keeping undiscovered species in Dex number order. */
export function sortDexEntries<T extends { id: string }>(
  entries: readonly T[],
  dex: ReadonlySet<string>,
  catchLog: readonly CatchEvent[],
  sort: DexSort,
  language: LangId,
  nameOf: (id: string) => string,
): T[] {
  const caught = entries.filter((entry) => dex.has(entry.id));
  const uncaught = entries.filter((entry) => !dex.has(entry.id));

  if (sort === 'name') {
    const collator = new Intl.Collator(language);
    const named = caught.map((entry) => ({ entry, name: nameOf(entry.id) }));
    named.sort((a, b) => collator.compare(a.name, b.name));
    return [...named.map(({ entry }) => entry), ...uncaught];
  }

  const firstCatchAt = new Map<string, number>();
  for (const { id, at } of catchLog) {
    if (Number.isFinite(at) && at < (firstCatchAt.get(id) ?? Infinity)) {
      firstCatchAt.set(id, at);
    }
  }
  // Older saves can contain caught species without a dated event.
  const dateOf = (id: string) => firstCatchAt.get(id) ?? -Infinity;
  caught.sort((a, b) => {
    const aDate = dateOf(a.id);
    const bDate = dateOf(b.id);
    return aDate === bDate ? 0 : bDate - aDate;
  });
  return [...caught, ...uncaught];
}
