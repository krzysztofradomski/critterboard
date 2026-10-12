import { describe, expect, it } from 'vitest';

import { buildContribution, isExpired, nextRetryAt, uploadOutcome } from '@/lib/contributions';

const NOW = Date.UTC(2026, 9, 12, 12);

describe('buildContribution', () => {
  const base = {
    id: 'c_test0001aa', bugId: 'harl', latin: 'Harmonia axyridis', kind: 'manual' as const,
    top3: [{ id: 'lady', p: 0.412345 }, { id: 'harl', p: 0.2 }], aim: { tap: [0.42, 0.61] as [number, number] },
    creditName: 'Krzysztof', modelVersion: 7, packVersion: 14, at: NOW,
  };
  it('builds the wire meta the worker expects, with the CC BY licence', () => {
    expect(buildContribution(base)).toEqual({
      id: 'c_test0001aa', bug_id: 'harl', latin: 'Harmonia axyridis', kind: 'manual',
      top3: [{ bug_id: 'lady', p: 0.4123 }, { bug_id: 'harl', p: 0.2 }],
      model_version: 7, pack_version: 14, aim: { tap: [0.42, 0.61] }, credit_name: 'Krzysztof',
      licence: 'CC-BY-4.0', at: NOW,
    });
  });
  it('never carries a location, and uses the default credit for the default name', () => {
    const m = buildContribution({ ...base, creditName: 'you' }) as unknown as Record<string, unknown>;
    expect(m.lat).toBeUndefined();
    expect(m.lng).toBeUndefined();
    expect(m.credit_name).toBe('Critterboard player');
  });
  it('clamps aim to photo fractions and keeps at most three guesses', () => {
    const m = buildContribution({ ...base, aim: { tap: [1.2, -0.1] }, top3: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, p: 0.1 })) });
    expect(m.aim).toEqual({ tap: [1, 0] });
    expect(m.top3).toHaveLength(3);
  });
});

describe('upload retries', () => {
  it('backs off 1 min, 5 min, 30 min, then 2 h', () => {
    expect(nextRetryAt(0, NOW) - NOW).toBe(60_000);
    expect(nextRetryAt(1, NOW) - NOW).toBe(300_000);
    expect(nextRetryAt(2, NOW) - NOW).toBe(1_800_000);
    expect(nextRetryAt(9, NOW) - NOW).toBe(7_200_000);
  });
  it('drops bad requests, retries rate limits and server errors', () => {
    expect(uploadOutcome(201)).toBe('done');
    expect(uploadOutcome(200)).toBe('done');
    expect(uploadOutcome(400)).toBe('drop');
    expect(uploadOutcome(409)).toBe('drop');
    expect(uploadOutcome(429)).toBe('retry');
    expect(uploadOutcome(503)).toBe('retry');
    expect(uploadOutcome(0)).toBe('retry'); // network error
  });
  it('expires items after 7 days', () => {
    expect(isExpired({ addedAt: NOW - 6 * 86_400_000 }, NOW)).toBe(false);
    expect(isExpired({ addedAt: NOW - 8 * 86_400_000 }, NOW)).toBe(true);
  });
});
