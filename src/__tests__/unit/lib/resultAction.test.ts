import { describe, expect, it } from 'vitest';

import { resultAction } from '@/lib/resultAction';

describe('resultAction (Result main button)', () => {
  it('adds a fresh scan of a new species', () => {
    expect(resultAction({ inDex: false, manualOnly: false, fresh: true })).toBe('add');
  });
  it('shares a species the model already caught', () => {
    expect(resultAction({ inDex: true, manualOnly: false, fresh: true })).toBe('share');
    expect(resultAction({ inDex: true, manualOnly: false, fresh: false })).toBe('share');
  });
  it('lets the model add a species that was only ever named by hand, so it can earn XP', () => {
    expect(resultAction({ inDex: true, manualOnly: true, fresh: true })).toBe('add');
  });
  it('shares a self-named species opened from the Dex, and hunts one never caught', () => {
    expect(resultAction({ inDex: true, manualOnly: true, fresh: false })).toBe('share');
    expect(resultAction({ inDex: false, manualOnly: false, fresh: false })).toBe('hunt');
  });
});
