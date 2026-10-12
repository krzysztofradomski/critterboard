/**
 * Training contributions: labelled photos players opt in to share (CC BY 4.0) for training
 * the next species model. Photos go to R2, one D1 row each. Players can count and delete
 * theirs; the developer exports them with TRAINING_ADMIN_TOKEN.
 *
 *   POST   /v1/training             multipart: meta (JSON) + photo (JPEG ≤ 2 MB)   [player]
 *   GET    /v1/training/mine        { count }                                      [player]
 *   DELETE /v1/training/mine        delete the player's photos and rows            [player]
 *   GET    /v1/training/export      ?since=<ms>&limit=<n>  rows + signed links      [admin]
 *   GET    /v1/training/object/:id  ?exp=<ms>&sig=<hex>    the JPEG                 [signed]
 */
import { SPECIES_XP } from './speciesXp';
import {
  contributorId, isJpeg, parseContributionMeta, r2KeyFor, safeEqual, signObject, verifyObjectSig,
} from './trainingRules';

export interface TrainingEnv {
  DB: D1Database;
  TRAINING: R2Bucket;
  /** Secret for the developer's export. Unset: the export answers 404. */
  TRAINING_ADMIN_TOKEN?: string;
  /** Uploads per player per 24 h (default 200). */
  TRAINING_DAILY_CAP?: string;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const LINK_TTL_MS = 3_600_000;
const DAY_MS = 86_400_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Row = {
  id: string; user_id: string; bug_id: string; latin: string; kind: string; top3: string;
  model_version: number | null; pack_version: number | null; aim: string; credit_name: string;
  licence: string; at: number; created_at: number; r2_key: string; bytes: number;
};

export async function handleTrainingUpload(userId: string, request: Request, env: TrainingEnv): Promise<Response> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_PHOTO_BYTES + 64 * 1024) return json({ error: 'too_large' }, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'bad_form' }, 400);
  }
  const metaRaw = form.get('meta');
  const photo = form.get('photo');
  if (typeof metaRaw !== 'string' || !photo || typeof photo === 'string') return json({ error: 'bad_form' }, 400);
  let parsed: unknown;
  try {
    parsed = JSON.parse(metaRaw);
  } catch {
    return json({ error: 'bad_meta' }, 400);
  }
  const now = Date.now();
  const meta = parseContributionMeta(parsed, SPECIES_XP, now);
  if (typeof meta === 'string') return json({ error: meta }, 400);

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return json({ error: 'bad_size' }, 400);
  if (!isJpeg(bytes)) return json({ error: 'not_jpeg' }, 400);

  // Idempotent on the client's id; an id belonging to someone else is refused.
  const existing = await env.DB.prepare('SELECT user_id FROM contributions WHERE id = ?').bind(meta.id).first<{ user_id: string }>();
  if (existing) return existing.user_id === userId ? json({ ok: true, id: meta.id }) : json({ error: 'conflict' }, 409);

  const cap = Number(env.TRAINING_DAILY_CAP ?? '200') || 200;
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM contributions WHERE user_id = ? AND created_at > ?')
    .bind(userId, now - DAY_MS).first<{ n: number }>();
  if ((recent?.n ?? 0) >= cap) return json({ error: 'daily_cap' }, 429);

  const key = r2KeyFor(meta.bug_id, meta.id, now);
  await env.TRAINING.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  try {
    await env.DB.prepare(
      `INSERT INTO contributions (id, user_id, bug_id, latin, kind, top3, model_version, pack_version, aim,
         credit_name, licence, at, created_at, r2_key, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      meta.id, userId, meta.bug_id, meta.latin, meta.kind, JSON.stringify(meta.top3), meta.model_version,
      meta.pack_version, JSON.stringify(meta.aim), meta.credit_name, meta.licence, meta.at, now, key, bytes.length,
    ).run();
  } catch {
    await env.TRAINING.delete(key).catch(() => undefined); // no orphan photo without its row
    return json({ error: 'store_failed' }, 500);
  }
  return json({ ok: true, id: meta.id }, 201);
}

export async function handleTrainingMine(userId: string, env: TrainingEnv): Promise<Response> {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM contributions WHERE user_id = ?').bind(userId).first<{ n: number }>();
  return json({ count: r?.n ?? 0 });
}

/** Delete every photo and row of a player (Delete my shared photos, and account deletion). */
export async function deleteUserContributions(userId: string, env: TrainingEnv): Promise<number> {
  const rows = await env.DB.prepare('SELECT r2_key FROM contributions WHERE user_id = ?').bind(userId).all<{ r2_key: string }>();
  const keys = (rows.results ?? []).map((r) => r.r2_key);
  for (let i = 0; i < keys.length; i += 1000) await env.TRAINING.delete(keys.slice(i, i + 1000));
  await env.DB.prepare('DELETE FROM contributions WHERE user_id = ?').bind(userId).run();
  return keys.length;
}

export async function handleTrainingDeleteMine(userId: string, env: TrainingEnv): Promise<Response> {
  return json({ deleted: await deleteUserContributions(userId, env) });
}

function adminOk(request: Request, token: string): boolean {
  const auth = request.headers.get('Authorization') ?? '';
  return auth.startsWith('Bearer ') && safeEqual(auth.slice(7), token);
}

export async function handleTrainingExport(request: Request, url: URL, env: TrainingEnv): Promise<Response> {
  const token = env.TRAINING_ADMIN_TOKEN;
  if (!token) return json({ error: 'not found' }, 404);
  if (!adminOk(request, token)) return json({ error: 'unauthorized' }, 401);
  const since = Math.max(0, Number(url.searchParams.get('since') ?? '0') || 0);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? '500') || 500));
  const rows = (
    await env.DB.prepare('SELECT * FROM contributions WHERE created_at > ? ORDER BY created_at ASC, id ASC LIMIT ?')
      .bind(since, limit).all<Row>()
  ).results ?? [];
  const exp = Date.now() + LINK_TTL_MS;
  const items = [];
  for (const r of rows) {
    items.push({
      id: r.id,
      contributor: await contributorId(token, r.user_id),
      bug_id: r.bug_id,
      latin: r.latin,
      kind: r.kind,
      top3: JSON.parse(r.top3),
      model_version: r.model_version,
      pack_version: r.pack_version,
      aim: JSON.parse(r.aim),
      credit_name: r.credit_name,
      licence: r.licence,
      at: r.at,
      created_at: r.created_at,
      bytes: r.bytes,
      object: `/v1/training/object/${r.id}?exp=${exp}&sig=${await signObject(token, r.id, exp)}`,
    });
  }
  const last = rows[rows.length - 1];
  return json({ items, next: rows.length === limit && last ? last.created_at : null });
}

export async function handleTrainingObject(id: string, url: URL, env: TrainingEnv): Promise<Response> {
  const token = env.TRAINING_ADMIN_TOKEN;
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';
  if (!token || !(await verifyObjectSig(token, id, exp, sig, Date.now()))) return json({ error: 'not found' }, 404);
  const row = await env.DB.prepare('SELECT r2_key FROM contributions WHERE id = ?').bind(id).first<{ r2_key: string }>();
  const obj = row ? await env.TRAINING.get(row.r2_key) : null;
  if (!obj) return json({ error: 'not found' }, 404);
  return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' } });
}
