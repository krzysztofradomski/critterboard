import { allBugs, BUGS, type Bug } from '@/data/bugs';

/**
 * Pool the Bug-of-the-Day rotates through: the rarer species (rare and up)
 * across the bundled list *and* installed region packs, so the hero card
 * is always a "worth hunting" target and its rarity tag is truthful.
 * Computed per call because packs merge into the registry after boot.
 */
const HERO_RARITIES: ReadonlySet<Bug['rarity']> = new Set(['rare', 'epic', 'legendary']);

function heroPool(): readonly Bug[] {
  const all = allBugs();
  const rare = all.filter((b) => HERO_RARITIES.has(b.rarity));
  return rare.length > 0 ? rare : all;
}

/**
 * Day-of-year for the supplied date (`1..366`). Stable across timezones
 * within the user's local day — we deliberately use the device clock,
 * not UTC, so "today" matches what the user's wall calendar says.
 */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Deterministically pick today's hero bug. Same calendar day → same bug
 * on every render; midnight rollover advances by one slot. Defaults to
 * `now` for the easy callsite, but accepts an explicit date for tests.
 *
 * If there are no rarer species at all, the pool is every species;
 * if that is somehow empty, falls back to the first BUG in the dataset.
 */
export function bugOfDay(date: Date = new Date()): Bug {
  const pool = heroPool();
  if (pool.length === 0) return BUGS[0]!;
  return pool[dayOfYear(date) % pool.length]!;
}
