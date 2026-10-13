import { isOffensiveName } from '@/lib/moderation';

/**
 * Training contributions on the phone: the metadata sent with a shared photo, and the upload
 * retry rules. Pure. The worker validates the same shape (worker/src/trainingRules.ts).
 * Never carries a location: only the species, the model's guesses and where the bug is in
 * the photo (as fractions of its width/height).
 */

export type ContributionMeta = {
  id: string;
  bug_id: string;
  latin: string;
  kind: 'manual' | 'confirmed';
  top3: { bug_id: string; p: number }[];
  model_version: number | null;
  pack_version: number | null;
  aim: { tap?: [number, number]; reticle?: [number, number, number] };
  credit_name: string;
  licence: 'CC-BY-4.0';
  at: number;
};

export type Aim = { tap?: [number, number]; reticle?: [number, number, number] };

export const DEFAULT_CREDIT = 'Critterboard player';
/** The profile's default name in each app language (common.you): credit as the generic player. */
const UNSET_NAMES = new Set(['', 'you', 'ty', 'du', 'tú']);

/** The CC BY credit for a player: their in-app name, unless it's unset or fails the name filter. */
export function creditNameFor(name: string): string {
  const n = name.trim().slice(0, 40);
  return UNSET_NAMES.has(n.toLowerCase()) || isOffensiveName(n) ? DEFAULT_CREDIT : n;
}

const frac = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

export function buildContribution(c: {
  id: string;
  bugId: string;
  latin: string;
  kind: 'manual' | 'confirmed';
  top3: { id: string; p: number }[];
  aim: Aim;
  creditName: string;
  modelVersion: number | null;
  packVersion: number | null;
  at: number;
}): ContributionMeta {
  const aim: Aim = {};
  if (c.aim.tap) aim.tap = [round4(frac(c.aim.tap[0])), round4(frac(c.aim.tap[1]))];
  else if (c.aim.reticle) {
    const [x, y, s] = c.aim.reticle;
    aim.reticle = [round4(frac(x)), round4(frac(y)), round4(Math.max(0.0001, frac(s)))];
  }
  return {
    id: c.id,
    bug_id: c.bugId,
    latin: c.latin,
    kind: c.kind,
    top3: c.top3.slice(0, 3).map((g) => ({ bug_id: g.id, p: round4(frac(g.p)) })),
    model_version: c.modelVersion,
    pack_version: c.packVersion,
    aim,
    credit_name: creditNameFor(c.creditName),
    licence: 'CC-BY-4.0',
    at: c.at,
  };
}

/** A fresh client id: `c_` + time + random, unique enough for one player's uploads. */
export function newContributionId(now = Date.now()): string {
  return `c_${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000];
export const QUEUE_MAX_AGE_MS = 7 * 86_400_000;

export function nextRetryAt(tries: number, now: number): number {
  return now + BACKOFF_MS[Math.min(tries, BACKOFF_MS.length - 1)]!;
}

/** What to do with a queued photo after an upload attempt (status 0 = no answer). */
export function uploadOutcome(status: number): 'done' | 'retry' | 'drop' {
  if (status >= 200 && status < 300) return 'done';
  // 404: the route isn't deployed yet (app out before the worker); keep the photo until it is.
  if (status === 0 || status === 404 || status === 429 || status >= 500) return 'retry';
  return 'drop'; // a bad request won't get better
}

export function isExpired(item: { addedAt: number }, now: number): boolean {
  return now - item.addedAt > QUEUE_MAX_AGE_MS;
}
