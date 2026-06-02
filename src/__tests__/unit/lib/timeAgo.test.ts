import { describe, it, expect } from 'vitest';
import { timeAgo } from '@/lib/timeAgo';

const SEC = 1000;
const MIN = 60 * SEC;
const HR = 60 * MIN;
const DAY = 24 * HR;

describe('timeAgo (U-T-*)', () => {
  const now = Date.now();

  it('U-T-01: 30 seconds ago → "just now"', () => {
    expect(timeAgo(now - 30 * SEC, 'en', now)).toBe('just now');
  });

  it('0 seconds ago → "just now"', () => {
    expect(timeAgo(now, 'en', now)).toBe('just now');
  });

  it('59 seconds ago → "just now"', () => {
    expect(timeAgo(now - 59 * SEC, 'en', now)).toBe('just now');
  });

  it('U-T-02: 90 seconds ago → "1 min ago"', () => {
    expect(timeAgo(now - 90 * SEC, 'en', now)).toBe('1 min ago');
  });

  it('5 minutes ago → "5 min ago"', () => {
    expect(timeAgo(now - 5 * MIN, 'en', now)).toBe('5 min ago');
  });

  it('59 minutes ago → "59 min ago"', () => {
    expect(timeAgo(now - 59 * MIN, 'en', now)).toBe('59 min ago');
  });

  it('U-T-03: 2 hours ago → "2 hr ago"', () => {
    expect(timeAgo(now - 2 * HR, 'en', now)).toBe('2 hr ago');
  });

  it('23 hours ago → "23 hr ago"', () => {
    expect(timeAgo(now - 23 * HR, 'en', now)).toBe('23 hr ago');
  });

  it('U-T-04: 25 hours ago → "1d ago"', () => {
    expect(timeAgo(now - 25 * HR, 'en', now)).toBe('1d ago');
  });

  it('U-T-05: 8 days ago → "8d ago"', () => {
    expect(timeAgo(now - 8 * DAY, 'en', now)).toBe('8d ago');
  });

  it('U-T-06: future timestamp → "just now" (clamped to 0 delta)', () => {
    const result = timeAgo(now + HR, 'en', now);
    expect(result).toBe('just now');
  });

  it('works with "pl" locale (returns a non-empty string)', () => {
    const result = timeAgo(now - 5 * MIN, 'pl', now);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('works with "de" locale (returns a non-empty string)', () => {
    const result = timeAgo(now - 2 * HR, 'de', now);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
