// End-to-end check of the API's privacy and abuse rules against a local `wrangler dev`
// with a throwaway D1/KV/DO store. Run: npm run smoke (from worker/).
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const persist = mkdtempSync(join(tmpdir(), 'critterboard-smoke-'));
const wrangler = (...args) => execFileSync('npx', ['wrangler', ...args], { stdio: 'pipe' });

wrangler('d1', 'execute', 'critterboard', '--local', '--persist-to', persist, '--file=schema.sql');
const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--persist-to', persist, '--var', 'JWT_SECRET:smoke-only-secret'], {
  stdio: 'ignore',
});

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function user(name, visible) {
  const id = `smoke_${name}_${Math.random().toString(36).slice(2, 10)}`;
  const auth = await call('POST', '/v1/auth', null, { userId: id, secret: 's'.repeat(40) + name });
  assert.equal(auth.status, 200, `auth ${name}`);
  const u = { id, token: auth.body.token };
  if (visible !== undefined) {
    const p = await call('POST', '/v1/profile', u.token, { displayName: name, leaderboardVisible: visible });
    assert.equal(p.status, 204, `profile ${name}`);
  }
  return u;
}

const ids = (page) => page.body.entries.map((e) => e.userId);
const NOW = Date.now();

try {
  for (let i = 0; ; i++) {
    try {
      await fetch(BASE + '/');
      break;
    } catch {
      if (i > 120) throw new Error('wrangler dev did not start');
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const ann = await user('Ann', true);
  const ben = await user('Ben', true);
  const hid = await user('Hid'); // registered, never synced a profile
  const off = await user('Off', false); // explicitly hidden

  // 3: a fresh login is hidden. 1: a hidden caller who triggers a cache rebuild isn't cached in.
  assert.equal((await call('POST', '/v1/catches', hid.token, { bugId: 'adalia-bipunctata', at: NOW })).status, 204);
  for (const scope of ['global', 'weekly']) {
    const forHidden = await call('GET', `/v1/leaderboard?scope=${scope}`, off.token);
    assert.ok(!ids(forHidden).includes(off.id) && !ids(forHidden).includes(hid.id), `${scope}: hidden users absent`);
    const forAnn = await call('GET', `/v1/leaderboard?scope=${scope}`, ann.token);
    assert.deepEqual(ids(forAnn).sort(), [ann.id, ben.id].sort(), `${scope}: only visible users, also for the next caller`);
  }

  // 2: suggestions only list visible users and carry no invented reason.
  const sugg = await call('GET', '/v1/friends?scope=suggested', off.token);
  assert.deepEqual(ids(sugg).sort(), [ann.id, ben.id].sort());
  assert.ok(sugg.body.entries.every((e) => e.reason === undefined));

  // 9: made-up species score nothing; a real one scores its listed XP.
  await call('POST', '/v1/catches', ann.token, { bugId: 'adalia-bipunctata', at: NOW - 1000 });
  await call('POST', '/v1/catches/batch', ann.token, { catches: [{ bugId: 'fake-bug-1', at: NOW }, { bugId: 'fake-bug-2', at: NOW }] });
  const annXp = (await call('GET', '/v1/leaderboard?scope=global', ann.token)).body.entries.find((e) => e.userId === ann.id).xp;
  assert.equal(annXp, 90, 'only the real species counts');

  // 10: single uploads get the batch's checks.
  assert.equal((await call('POST', '/v1/catches', ann.token, { bugId: 'adalia-bipunctata', at: 32_503_680_000_000 })).status, 400, 'year 3000');
  assert.equal((await call('POST', '/v1/catches', ann.token, { bugId: 'adalia-bipunctata' })).status, 400, 'no time');
  assert.equal((await call('POST', '/v1/catches', ann.token, { bugId: 'Bad Id', at: NOW })).status, 400, 'bad id');
  assert.equal((await call('POST', '/v1/catches', ann.token, { bugId: 'adalia-bipunctata', at: NOW - 5, lat: 'x', lng: 1 })).status, 204, 'bad coords dropped, catch kept');

  // 12: bounded fields, safe JSON; a rejected name still applies the privacy fields (3).
  assert.equal((await call('POST', '/v1/catches', ann.token, '{not json')).status, 400, 'bad json');
  assert.equal((await call('POST', '/v1/profile', ann.token, { displayName: 'Ann', avatarEmoji: 'x'.repeat(100), leaderboardVisible: true })).status, 400);
  assert.equal((await call('POST', '/v1/profile', ann.token, { displayName: 'x'.repeat(5000), leaderboardVisible: true })).status, 422);
  assert.equal((await call('POST', '/v1/profile', ben.token, { displayName: 'Spicy Grape', leaderboardVisible: false })).status, 422);
  const afterHide = await call('GET', '/v1/leaderboard?scope=global', ann.token);
  assert.deepEqual(ids(afterHide), [ann.id], 'Ben hid despite the rejected name, and drops off at once');
  assert.equal(afterHide.body.entries[0].displayName, 'Ann', 'overlong name kept the old one');
  await call('POST', '/v1/profile', ben.token, { displayName: 'Ben', leaderboardVisible: true });

  // 11: no ghost targets, one "followed you" per person however often they re-follow.
  assert.equal((await call('POST', '/v1/follows/nobody_at_all_123', ann.token)).status, 404);
  for (const method of ['POST', 'POST', 'DELETE', 'POST', 'DELETE', 'POST']) await call(method, `/v1/follows/${ben.id}`, ann.token);
  const benFeed = await call('GET', '/v1/feed', ben.token);
  assert.equal(benFeed.body.events.filter((e) => e.kind === 'follow' && e.actor.userId === ann.id).length, 1);

  // Shared sightings: other players' located catches near a point, nearest first, without user ids.
  // Own, unlocated, older than a year and far-away catches never show; cleared locations vanish.
  const near = (who, lat = 50.06, lng = 19.94) => call('GET', `/v1/sightings/nearby?lat=${lat}&lng=${lng}`, who.token);
  await call('POST', '/v1/catches', ann.token, { bugId: 'aglais-io', at: NOW - 10, lat: 50.07, lng: 19.95 });
  await call('POST', '/v1/catches', ann.token, { bugId: 'adalia-bipunctata', at: NOW - 11, lat: 50.5, lng: 19.94 });
  await call('POST', '/v1/catches/batch', ann.token, { catches: [{ bugId: 'aglais-io', at: NOW - 400 * 86_400_000, lat: 50.06, lng: 19.94 }] });
  await call('POST', '/v1/catches', ann.token, { bugId: 'aglais-io', at: NOW - 12, lat: 52.23, lng: 21.0 }); // Warsaw: outside the box
  await call('POST', '/v1/catches', ben.token, { bugId: 'aglais-io', at: NOW - 13, lat: 50.06, lng: 19.94 }); // Ben's own
  const forBen = await near(ben);
  assert.equal(forBen.status, 200);
  assert.deepEqual(forBen.body.sightings.map((x) => x.lat), [50.07, 50.5], 'nearest first; own, old and far ones absent');
  assert.ok(forBen.body.sightings.every((x) => Object.keys(x).sort().join() === 'at,bugId,lat,lng'), 'anonymous');
  assert.equal((await near(ben, 'x', 1)).status, 400, 'bad location');
  assert.equal((await call('DELETE', '/v1/catches/locations', ann.token)).status, 204);
  assert.equal((await near(ben)).body.sightings.length, 0, 'cleared locations are gone');

  // 5: deleting Ann also scrubs Ann's "followed you" from Ben (someone she followed).
  assert.equal((await call('DELETE', '/v1/account', ann.token)).status, 204);
  const benAfter = await call('GET', '/v1/feed', ben.token);
  assert.ok(!benAfter.body.events.some((e) => e.actor.userId === ann.id), 'no events naming a deleted user');

  // 13: auth is rate-limited per IP (5 logins so far; the limit is 10 a minute).
  let limited = false;
  for (let i = 0; i < 10 && !limited; i++) {
    limited = (await call('POST', '/v1/auth', null, { userId: `smoke_rl_${i}_abcdef`, secret: 's'.repeat(40) })).status === 429;
  }
  assert.ok(limited, 'auth answers 429 past the limit');

  console.log('smoke: all checks passed');
} finally {
  dev.kill();
  rmSync(persist, { recursive: true, force: true });
}
