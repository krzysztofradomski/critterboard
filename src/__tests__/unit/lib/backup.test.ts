import { describe, expect, it } from 'vitest';

import { BACKUP_SCHEMA, buildBackup, parseBackup, planRestore } from '@/lib/backup';

const src = {
  dex: new Set(['lady', 'hcat']),
  catchLog: [{ id: 'lady', at: 1000, lat: 50, lng: 19, photoUri: 'file:///x.jpg' }, { id: 'hcat', at: 2000 }],
  questProgress: { q1: 2 },
  questCompletedAt: { q1: 5 },
  questClaimedAt: {},
  persona: 'larva' as const,
  language: 'pl' as const,
  profile: { name: 'Ola', minConfidence: 50, hapticsOn: false },
  activeRegion: 'eu-ce',
  backendUserId: 'user-1234567890',
  backendSecret: 's'.repeat(64),
};

describe('backup file', () => {
  it('round-trips, drops photos, and leaves the online key out unless asked', () => {
    const plain = JSON.parse(JSON.stringify(buildBackup(src, { includeIdentity: false })));
    expect(plain.identity).toBeUndefined();
    expect(JSON.stringify(plain)).not.toContain('file:///');
    expect(parseBackup(JSON.stringify(plain))).toMatchObject({ schema: BACKUP_SCHEMA, dex: ['hcat', 'lady'], language: 'pl' });
    const withKey = parseBackup(JSON.stringify(buildBackup(src, { includeIdentity: true })));
    expect(withKey?.identity?.userId).toBe('user-1234567890');
  });

  it('rejects files that are not a valid backup', () => {
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup('{"schema":"other"}')).toBeNull();
    const ok = JSON.parse(JSON.stringify(buildBackup(src, { includeIdentity: false })));
    expect(parseBackup(JSON.stringify({ ...ok, dex: ['bad id!'] }))).toBeNull();
    expect(parseBackup(JSON.stringify({ ...ok, catchLog: [{ id: 'lady', at: 'x' }] }))).toBeNull();
    expect(parseBackup(JSON.stringify({ ...ok, language: 'xx' }))).toBeNull();
    expect(parseBackup(JSON.stringify({ ...ok, identity: { userId: 'short', secret: 'x' } }))).toBeNull();
  });
});

describe('planRestore', () => {
  const backup = parseBackup(JSON.stringify(buildBackup(src, { includeIdentity: true })))!;
  const empty = {
    dex: new Set<string>(),
    catchLog: [],
    questProgress: {},
    questCompletedAt: {},
    questClaimedAt: {},
    persona: 'snail' as const,
    language: 'en' as const,
    profile: { name: 'you', minConfidence: 33, hapticsOn: true },
    activeRegion: null,
    backendUserId: 'fresh-device-id-1',
    backendSecret: 'f'.repeat(64),
    online: { hasData: false },
    installedRegions: [] as string[],
  };

  it('restores onto a fresh install, adopting the online identity and asking for the region pack', () => {
    const { patch, summary } = planRestore(empty, backup);
    expect(summary).toEqual({ species: 2, catches: 2, adoptedIdentity: true, needsRegion: 'eu-ce' });
    expect(patch.backendUserId).toBe('user-1234567890');
    expect((patch.dex as Set<string>).has('lady')).toBe(true);
  });

  it('merges instead of replacing: keeps newer local catches and the higher quest progress', () => {
    const cur = { ...empty, dex: new Set(['stag']), catchLog: [{ id: 'stag', at: 3000 }], questProgress: { q1: 5 }, installedRegions: ['eu-ce'] };
    const { patch, summary } = planRestore(cur, backup);
    expect(summary.catches).toBe(3);
    expect((patch.dex as Set<string>).has('stag')).toBe(true);
    expect((patch.questProgress as Record<string, number>).q1).toBe(5);
    expect(summary.needsRegion).toBeNull();
  });

  it('never swaps the identity of a phone that already has online data', () => {
    const { patch, summary } = planRestore({ ...empty, online: { hasData: true } }, backup);
    expect(summary.adoptedIdentity).toBe(false);
    expect(patch.backendUserId).toBeUndefined();
  });
});
