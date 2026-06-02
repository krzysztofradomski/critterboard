import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { BUGS, findBug } from '@/data/bugs';
import type { LangId } from '@/i18n';
import { bugName } from '@/i18n/helpers';
import type { CatchEvent } from '@/lib/streak';

/**
 * Filename-safe local-day stamp (`YYYY-MM-DD`). The exported file lands
 * in the user's chosen share target as-is, so we keep the slug ASCII and
 * extension-free — the caller appends `.json` / `.csv`.
 */
function todayStamp(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * What you get when you build an export blob in memory: the rendered
 * payload + the suggested filename. Decoupled from the actual file/share
 * step so unit tests (and the i18n toast) can see the deterministic
 * outputs without going through the OS sheet.
 */
export type ExportBlob = {
  filename: string;
  mimeType: string;
  body: string;
};

// ──────────────────────────────────────────────────────────────────────────
// JSON export — the dex
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build the dex export JSON. Includes all 12 species in `BUGS`, flagged
 * `caught: true/false`. `firstCaughtAt` is the earliest catchLog
 * timestamp for that species (or null if not caught yet) — gives the
 * user a real history they can re-import or grep through.
 */
export function buildDexJson(
  dex: ReadonlySet<string>,
  catchLog: ReadonlyArray<CatchEvent>,
  lang: LangId,
  trainerName: string,
  now: number = Date.now(),
): ExportBlob {
  const firstAt = new Map<string, number>();
  for (const e of catchLog) {
    const prev = firstAt.get(e.id);
    if (prev === undefined || e.at < prev) firstAt.set(e.id, e.at);
  }

  const species = BUGS.map((b) => ({
    id: b.id,
    name: bugName(lang, b.id),
    latin: b.latin,
    rarity: b.rarity,
    tier: b.tier,
    xp: b.xp,
    caught: dex.has(b.id),
    firstCaughtAt: firstAt.has(b.id) ? new Date(firstAt.get(b.id)!).toISOString() : null,
  }));

  const payload = {
    schema: 'critterboard.dex.v1',
    exportedAt: new Date(now).toISOString(),
    trainer: trainerName,
    caught: dex.size,
    total: BUGS.length,
    species,
  };

  return {
    filename: `critterboard-dex-${todayStamp(now)}.json`,
    mimeType: 'application/json',
    body: JSON.stringify(payload, null, 2),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CSV export — sightings (one row per catch event)
// ──────────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = ['caughtAt', 'bugId', 'name', 'latin', 'rarity', 'xp'] as const;

/**
 * RFC 4180-ish CSV escaping: wrap in quotes if the field contains comma,
 * quote, or newline; escape inner quotes by doubling them. Keeps the
 * file openable directly in Numbers / Excel / pandas.
 */
function csvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildSightingsCsv(
  catchLog: ReadonlyArray<CatchEvent>,
  lang: LangId,
  now: number = Date.now(),
): ExportBlob {
  const lines: string[] = [CSV_COLUMNS.join(',')];
  const sorted = [...catchLog].sort((a, b) => a.at - b.at);
  for (const e of sorted) {
    const bug = findBug(e.id);
    lines.push(
      [
        new Date(e.at).toISOString(),
        e.id,
        bugName(lang, e.id),
        bug?.latin ?? '',
        bug?.rarity ?? '',
        bug?.xp ?? 0,
      ]
        .map(csvField)
        .join(','),
    );
  }

  return {
    filename: `critterboard-sightings-${todayStamp(now)}.csv`,
    mimeType: 'text/csv',
    body: lines.join('\n') + '\n',
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Share — write blob to cache + hand to OS share sheet
// ──────────────────────────────────────────────────────────────────────────

export type ShareOutcome =
  | { ok: true; filename: string }
  | { ok: false; reason: 'unavailable' | 'error'; filename: string };

/**
 * Write the blob into the app's cache directory and present the OS share
 * sheet. The cache dir is the right home for these — the user has
 * already pulled the data into a share target by the time control
 * returns, and we don't want to bloat documents-on-disk with copies.
 *
 * Returns the outcome so the caller can show a truthful toast (saved vs.
 * unavailable vs. error).
 */
export async function shareBlob(blob: ExportBlob): Promise<ShareOutcome> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return { ok: false, reason: 'unavailable', filename: blob.filename };

  const uri = dir + blob.filename;
  try {
    await FileSystem.writeAsStringAsync(uri, blob.body, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'unavailable', filename: blob.filename };
    }
    await Sharing.shareAsync(uri, {
      mimeType: blob.mimeType,
      dialogTitle: blob.filename,
      UTI: blob.mimeType === 'application/json' ? 'public.json' : 'public.comma-separated-values-text',
    });
    return { ok: true, filename: blob.filename };
  } catch {
    return { ok: false, reason: 'error', filename: blob.filename };
  }
}
