/**
 * Pure rules for training contributions (POST /v1/training and the export): validate the
 * metadata a phone sends, build storage keys, sign download links. Kept apart from the
 * routes so the app's unit tests can cover them.
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

export const DEFAULT_CREDIT = 'Critterboard player';
const EARLIEST_AT = Date.UTC(2025, 0, 1);
const DAY_MS = 86_400_000;

const isFrac = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const optInt = (x: unknown): number | null | undefined =>
  x === undefined || x === null ? null : Number.isInteger(x) && (x as number) >= 0 ? (x as number) : undefined;

/** The validated metadata, or an error code. Fields it doesn't know (a location, say) are dropped. */
export function parseContributionMeta(
  raw: unknown,
  knownSpecies: Record<string, number>,
  now: number,
): ContributionMeta | string {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return 'bad_meta';
  if (typeof r.id !== 'string' || !/^c_[0-9A-Za-z_-]{8,64}$/.test(r.id)) return 'bad_id';
  if (typeof r.bug_id !== 'string' || !Object.prototype.hasOwnProperty.call(knownSpecies, r.bug_id)) return 'bad_bug';
  if (typeof r.latin !== 'string' || r.latin.length === 0 || r.latin.length > 120) return 'bad_latin';
  if (r.kind !== 'manual' && r.kind !== 'confirmed') return 'bad_kind';
  if (r.licence !== 'CC-BY-4.0') return 'bad_licence';

  if (!Array.isArray(r.top3) || r.top3.length > 3) return 'bad_top3';
  const top3: ContributionMeta['top3'] = [];
  for (const g of r.top3 as Array<Record<string, unknown>>) {
    if (typeof g?.bug_id !== 'string' || g.bug_id.length > 64 || !isFrac(g.p)) return 'bad_top3';
    top3.push({ bug_id: g.bug_id, p: g.p });
  }

  const modelVersion = optInt(r.model_version);
  const packVersion = optInt(r.pack_version);
  if (modelVersion === undefined || packVersion === undefined) return 'bad_version';

  const a = r.aim as Record<string, unknown> | null;
  if (!a || typeof a !== 'object' || Array.isArray(a)) return 'bad_aim';
  const keys = Object.keys(a);
  const aim: ContributionMeta['aim'] = {};
  if (keys.length > 1 || (keys.length === 1 && keys[0] !== 'tap' && keys[0] !== 'reticle')) return 'bad_aim';
  if (a.tap !== undefined) {
    if (!Array.isArray(a.tap) || a.tap.length !== 2 || !a.tap.every(isFrac)) return 'bad_aim';
    aim.tap = [a.tap[0], a.tap[1]];
  }
  if (a.reticle !== undefined) {
    if (!Array.isArray(a.reticle) || a.reticle.length !== 3 || !a.reticle.every(isFrac) || a.reticle[2] === 0) return 'bad_aim';
    aim.reticle = [a.reticle[0], a.reticle[1], a.reticle[2]];
  }

  if (typeof r.credit_name !== 'string') return 'bad_credit';
  const credit = r.credit_name.trim();
  // eslint-disable-next-line no-control-regex
  if (credit.length > 40 || /[\u0000-\u001f\u007f]/.test(credit)) return 'bad_credit';

  if (!Number.isInteger(r.at) || (r.at as number) < EARLIEST_AT || (r.at as number) > now + DAY_MS) return 'bad_at';

  return {
    id: r.id,
    bug_id: r.bug_id,
    latin: r.latin,
    kind: r.kind,
    top3,
    model_version: modelVersion,
    pack_version: packVersion,
    aim,
    credit_name: credit || DEFAULT_CREDIT,
    licence: 'CC-BY-4.0',
    at: r.at as number,
  };
}

/** `<yyyy-mm>/<bug_id>/<id>.jpg`, by upload month. */
export function r2KeyFor(bugId: string, id: string, now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}/${bugId}/${id}.jpg`;
}

export function isJpeg(head: Uint8Array): boolean {
  return head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

/** Constant-time string comparison, for the admin token. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A download link's signature: HMAC-SHA256(admin token, "<id>.<expiry ms>"). */
export function signObject(token: string, id: string, exp: number): Promise<string> {
  return hmacHex(token, `${id}.${exp}`);
}

export async function verifyObjectSig(token: string, id: string, exp: number, sig: string, now: number): Promise<boolean> {
  if (!Number.isFinite(exp) || exp < now) return false;
  return safeEqual(await signObject(token, id, exp), sig);
}

/**
 * A stable pseudonym per player for the export (so a model's train/test split can keep one
 * player's photos together) without handing out account ids.
 */
export async function contributorId(token: string, userId: string): Promise<string> {
  return (await hmacHex(token, `contributor:${userId}`)).slice(0, 16);
}
