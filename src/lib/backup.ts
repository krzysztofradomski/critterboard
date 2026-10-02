import type { LangId } from '@/i18n';
import { isKnownLang } from '@/i18n';
import type { CatchEvent } from '@/lib/streak';
import { PERSONA_IDS, type PersonaId } from '@/personas';
import type { Profile } from '@/store/useAppStore';

/**
 * A manual, file-based backup: nothing is stored anywhere but where the user puts the file.
 *
 * Restoring MERGES into what is on the phone (Dex and catches are unions, quest progress keeps the
 * higher value), so importing never destroys newer data. Sharing choices (Network, leaderboard,
 * location sharing, crash reports) are deliberately NOT restored: after a restore everything
 * online is off until the user turns it on again. Photos and chat history are not included.
 */

export const BACKUP_SCHEMA = 'critterboard.backup.v1';
const MAX_CATCHES = 50_000;
const ID_RE = /^[a-z0-9_-]{1,64}$/i;

export type Backup = {
  schema: typeof BACKUP_SCHEMA;
  exportedAt: string;
  dex: string[];
  /** `id` is the species id, as in the app's catch log. Photos are not included. */
  catchLog: Array<{ id: string; at: number; lat?: number; lng?: number }>;
  questProgress: Record<string, number>;
  questCompletedAt: Record<string, number>;
  questClaimedAt: Record<string, number>;
  persona: PersonaId;
  language: LangId;
  settings: { name: string; minConfidence: number; hapticsOn: boolean };
  /** Region the user had active, so the app can offer to download it again. */
  activeRegion: string | null;
  /** Only present when the user chose to include it: it is a secret that proves who they are online. */
  identity?: { userId: string; secret: string };
};

type Source = {
  dex: ReadonlySet<string>;
  catchLog: ReadonlyArray<CatchEvent>;
  questProgress: Record<string, number>;
  questCompletedAt: Record<string, number>;
  questClaimedAt: Record<string, number>;
  persona: PersonaId;
  language: LangId;
  profile: Pick<Profile, 'name' | 'minConfidence' | 'hapticsOn'>;
  activeRegion: string | null;
  backendUserId: string;
  backendSecret: string;
};

export function buildBackup(src: Source, opts: { includeIdentity: boolean }, now = Date.now()): Backup {
  const backup: Backup = {
    schema: BACKUP_SCHEMA,
    exportedAt: new Date(now).toISOString(),
    dex: [...src.dex].sort(),
    catchLog: src.catchLog.map((c) => ({
      id: c.id,
      at: c.at,
      ...(c.lat !== undefined && c.lng !== undefined ? { lat: c.lat, lng: c.lng } : {}),
    })),
    questProgress: src.questProgress,
    questCompletedAt: src.questCompletedAt,
    questClaimedAt: src.questClaimedAt,
    persona: src.persona,
    language: src.language,
    settings: {
      name: src.profile.name,
      minConfidence: src.profile.minConfidence,
      hapticsOn: src.profile.hapticsOn,
    },
    activeRegion: src.activeRegion,
  };
  if (opts.includeIdentity) backup.identity = { userId: src.backendUserId, secret: src.backendSecret };
  return backup;
}

export function backupFilename(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `critterboard-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numMap = (v: unknown): Record<string, number> | null => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!ID_RE.test(k) || !isNum(val)) return null;
    out[k] = val;
  }
  return out;
};

/** Validate untrusted file contents. Returns null for anything that isn't a Critterboard backup we understand. */
export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.schema !== BACKUP_SCHEMA) return null;

  if (!Array.isArray(r.dex) || r.dex.length > MAX_CATCHES || !r.dex.every((x) => typeof x === 'string' && ID_RE.test(x))) return null;
  if (!Array.isArray(r.catchLog) || r.catchLog.length > MAX_CATCHES) return null;
  const catchLog: Backup['catchLog'] = [];
  for (const c of r.catchLog as Array<Record<string, unknown>>) {
    if (typeof c?.id !== 'string' || !ID_RE.test(c.id) || !isNum(c.at) || c.at < 0) return null;
    const hasLoc = isNum(c.lat) && isNum(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
    catchLog.push({ id: c.id, at: c.at, ...(hasLoc ? { lat: c.lat as number, lng: c.lng as number } : {}) });
  }
  const questProgress = numMap(r.questProgress);
  const questCompletedAt = numMap(r.questCompletedAt);
  const questClaimedAt = numMap(r.questClaimedAt);
  if (!questProgress || !questCompletedAt || !questClaimedAt) return null;

  const s = r.settings as Record<string, unknown> | undefined;
  if (!s || typeof s.name !== 'string' || s.name.length > 18 || !isNum(s.minConfidence) || typeof s.hapticsOn !== 'boolean') return null;
  if (typeof r.persona !== 'string' || !(PERSONA_IDS as readonly string[]).includes(r.persona)) return null;
  if (typeof r.language !== 'string' || !isKnownLang(r.language)) return null;
  if (r.activeRegion !== null && (typeof r.activeRegion !== 'string' || !ID_RE.test(r.activeRegion))) return null;

  const backup: Backup = {
    schema: BACKUP_SCHEMA,
    exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '',
    dex: r.dex as string[],
    catchLog,
    questProgress,
    questCompletedAt,
    questClaimedAt,
    persona: r.persona as PersonaId,
    language: r.language,
    settings: {
      name: s.name,
      minConfidence: Math.min(90, Math.max(10, Math.round(s.minConfidence))),
      hapticsOn: s.hapticsOn,
    },
    activeRegion: r.activeRegion as string | null,
  };
  const id = r.identity as Record<string, unknown> | undefined;
  if (id) {
    if (typeof id.userId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(id.userId)) return null;
    if (typeof id.secret !== 'string' || id.secret.length < 32 || id.secret.length > 256) return null;
    backup.identity = { userId: id.userId, secret: id.secret };
  }
  return backup;
}

export type RestoreSummary = { species: number; catches: number; adoptedIdentity: boolean; needsRegion: string | null };

type Current = Source & { online: { hasData: boolean }; installedRegions: string[] };

/** What restoring `backup` onto `cur` would produce, as a patch of store fields plus a summary for the UI. */
export function planRestore(cur: Current, backup: Backup): { patch: Record<string, unknown>; summary: RestoreSummary } {
  const dex = new Set(cur.dex);
  backup.dex.forEach((id) => dex.add(id));

  const seen = new Set(cur.catchLog.map((c) => `${c.id}:${c.at}`));
  const added = backup.catchLog.filter((c) => !seen.has(`${c.id}:${c.at}`));
  const catchLog = [...cur.catchLog, ...added].sort((a, b) => a.at - b.at);
  // A catch in the log means the species is in the Dex.
  catchLog.forEach((c) => dex.add(c.id));

  const maxMap = (a: Record<string, number>, b: Record<string, number>) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  const unionMap = (a: Record<string, number>, b: Record<string, number>) => ({ ...b, ...a });

  // Adopt the backed-up online identity only if this phone has no online data of its own to lose.
  const adoptedIdentity = !!backup.identity && !cur.online.hasData && backup.identity.userId !== cur.backendUserId;

  const patch: Record<string, unknown> = {
    dex,
    catchLog,
    questProgress: maxMap(cur.questProgress, backup.questProgress),
    questCompletedAt: unionMap(cur.questCompletedAt, backup.questCompletedAt),
    questClaimedAt: unionMap(cur.questClaimedAt, backup.questClaimedAt),
    persona: backup.persona,
    language: backup.language,
    settings: backup.settings,
  };
  if (adoptedIdentity && backup.identity) {
    patch.backendUserId = backup.identity.userId;
    patch.backendSecret = backup.identity.secret;
  }
  const needsRegion =
    backup.activeRegion && !cur.installedRegions.includes(backup.activeRegion) ? backup.activeRegion : null;
  return {
    patch,
    summary: { species: dex.size, catches: catchLog.length, adoptedIdentity, needsRegion },
  };
}
