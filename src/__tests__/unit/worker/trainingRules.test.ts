import { describe, expect, it } from 'vitest';

import {
  isJpeg, parseContributionMeta, r2KeyFor, safeEqual, signObject, verifyObjectSig,
} from '../../../../worker/src/trainingRules';

const KNOWN = { harl: 25, lady: 25 };
const NOW = Date.UTC(2026, 9, 12, 12);
const good = {
  id: 'c_01J9ABCDEF0123', bug_id: 'harl', latin: 'Harmonia axyridis', kind: 'manual',
  top3: [{ bug_id: 'lady', p: 0.41 }], model_version: 7, pack_version: 14,
  aim: { tap: [0.42, 0.61] }, credit_name: 'Krzysztof', licence: 'CC-BY-4.0', at: NOW - 60_000,
};
const parse = (over: Record<string, unknown>) => parseContributionMeta({ ...good, ...over }, KNOWN, NOW);

describe('parseContributionMeta', () => {
  it('accepts a well-formed contribution', () => {
    expect(parse({})).toEqual(good);
  });
  it('rejects an unknown species, a bad kind or another licence', () => {
    expect(parse({ bug_id: 'nope' })).toBe('bad_bug');
    expect(parse({ kind: 'auto' })).toBe('bad_kind');
    expect(parse({ licence: 'CC0' })).toBe('bad_licence');
  });
  it('rejects malformed ids, top-3 and aim', () => {
    expect(parse({ id: '../etc' })).toBe('bad_id');
    expect(parse({ top3: [{ bug_id: 'x', p: 2 }] })).toBe('bad_top3');
    expect(parse({ top3: new Array(4).fill({ bug_id: 'x', p: 0.1 }) })).toBe('bad_top3');
    expect(parse({ aim: { tap: [1.5, 0.2] } })).toBe('bad_aim');
    expect(parse({ aim: { gps: [50, 19] } })).toBe('bad_aim');
  });
  it('accepts the reticle and gallery (no aim) forms', () => {
    expect(parse({ aim: { reticle: [0.5, 0.46, 0.36] } })).not.toBeTypeOf('string');
    expect(parse({ aim: {} })).not.toBeTypeOf('string');
  });
  it('caps the credit name and fills in a default', () => {
    expect(parse({ credit_name: 'x'.repeat(41) })).toBe('bad_credit');
    expect(parse({ credit_name: 'bad\u0000name' })).toBe('bad_credit');
    expect((parse({ credit_name: '  ' }) as { credit_name: string }).credit_name).toBe('Critterboard player');
  });
  it('rejects capture times far off', () => {
    expect(parse({ at: NOW + 2 * 86_400_000 })).toBe('bad_at');
    expect(parse({ at: Date.UTC(2024, 0, 1) })).toBe('bad_at');
  });
  it('drops fields it does not know, such as location', () => {
    const r = parse({ lat: 50.06, lng: 19.94 }) as Record<string, unknown>;
    expect(r.lat).toBeUndefined();
    expect(r.lng).toBeUndefined();
  });
});

describe('storage helpers', () => {
  it('keys objects by month, species and id', () => {
    expect(r2KeyFor('harl', 'c_01J9ABCDEF0123', NOW)).toBe('2026-10/harl/c_01J9ABCDEF0123.jpg');
  });
  it('recognises JPEG magic bytes', () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
  it('compares secrets in constant time', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
  it('signs object links that expire', async () => {
    const sig = await signObject('tok', 'c_1', NOW + 3_600_000);
    expect(await verifyObjectSig('tok', 'c_1', NOW + 3_600_000, sig, NOW)).toBe(true);
    expect(await verifyObjectSig('tok', 'c_2', NOW + 3_600_000, sig, NOW)).toBe(false);
    expect(await verifyObjectSig('other', 'c_1', NOW + 3_600_000, sig, NOW)).toBe(false);
    expect(await verifyObjectSig('tok', 'c_1', NOW + 3_600_000, sig, NOW + 3_600_001)).toBe(false);
  });
});

import { contributorId } from '../../../../worker/src/trainingRules';

describe('contributorId', () => {
  it('is stable per player, differs between players, and is not the account id', async () => {
    const a = await contributorId('tok', 'user-a');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await contributorId('tok', 'user-a')).toBe(a);
    expect(await contributorId('tok', 'user-b')).not.toBe(a);
    expect(a).not.toContain('user-a');
  });
});
