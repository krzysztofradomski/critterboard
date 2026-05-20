import { BUGS, type Bug } from '@/data/bugs';

/**
 * Pool the Bug-of-the-Day rotates through. Picked from the *legendary*
 * tier so the hero card's "★★★★★ LEGENDARY" badge always stays honest
 * and the XP reward (`+500`-ish) keeps the daily quest feeling worth it.
 *
 * If the legendary roster ever expands, the rotation extends with it
 * automatically.
 */
const HERO_POOL: Bug[] = BUGS.filter((b) => b.rarity === 'legendary');

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
 * If the pool is somehow empty (shouldn't happen — there are always
 * legendaries in `BUGS`), falls back to the first BUG in the dataset.
 */
export function bugOfDay(date: Date = new Date()): Bug {
  if (HERO_POOL.length === 0) return BUGS[0]!;
  const idx = dayOfYear(date) % HERO_POOL.length;
  return HERO_POOL[idx]!;
}
