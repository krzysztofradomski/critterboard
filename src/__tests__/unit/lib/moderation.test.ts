import { describe, it, expect } from 'vitest';
import { isOffensiveName } from '@/lib/moderation';

describe('isOffensiveName', () => {
  it('allows normal names', () => {
    expect(isOffensiveName('BeetleMaster99')).toBe(false);
    expect(isOffensiveName('you')).toBe(false);
    expect(isOffensiveName('Prof Larva')).toBe(false);
    expect(isOffensiveName('x')).toBe(false);
  });

  it('blocks exact offensive words', () => {
    expect(isOffensiveName('fuckface')).toBe(true);
    expect(isOffensiveName('shitlord')).toBe(true);
    expect(isOffensiveName('cunt')).toBe(true);
    expect(isOffensiveName('nigger')).toBe(true);
    expect(isOffensiveName('faggot')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isOffensiveName('FUCK')).toBe(true);
    expect(isOffensiveName('Shit')).toBe(true);
  });

  it('handles leetspeak substitutions', () => {
    expect(isOffensiveName('sh1t')).toBe(true);
    expect(isOffensiveName('fvck')).toBe(true);
    expect(isOffensiveName('4ssh0le')).toBe(true);
  });

  it('handles spaces stripped', () => {
    expect(isOffensiveName('f u c k')).toBe(true);
  });

  it('does not block innocent names that contain letter sequences', () => {
    expect(isOffensiveName('Classic')).toBe(false);
    expect(isOffensiveName('Beekeeper')).toBe(false);
    expect(isOffensiveName('Assassin')).toBe(false);
  });
});
