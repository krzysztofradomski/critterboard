import { describe, it, expect } from 'vitest';
import {
  buildSystemPrompt,
  toMessages,
  SUMMARY_THRESHOLD,
} from '@/ai/toolChatAdapter';
import { getPersona } from '@/personas';

const larva = getPersona('en', 'larva');

// ---------------------------------------------------------------------------
// SUMMARY_THRESHOLD
// ---------------------------------------------------------------------------

describe('SUMMARY_THRESHOLD (U-TCA-const-*)', () => {
  it('U-TCA-const-01: is a positive integer >= 6', () => {
    expect(Number.isInteger(SUMMARY_THRESHOLD)).toBe(true);
    expect(SUMMARY_THRESHOLD).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

describe('buildSystemPrompt (U-TCA-sysprompt-*)', () => {
  it('U-TCA-sysprompt-01: contains persona system prompt', () => {
    const result = buildSystemPrompt(larva, undefined, 'en');
    expect(result).toContain(larva.systemPrompt);
  });

  it('U-TCA-sysprompt-02: contains language instruction', () => {
    const result = buildSystemPrompt(larva, undefined, 'pl');
    expect(result).toContain('pl');
  });

  it('U-TCA-sysprompt-03: contains topic when provided', () => {
    const result = buildSystemPrompt(larva, 'beetles', 'en');
    expect(result).toContain('beetles');
  });

  it('U-TCA-sysprompt-04: falls back to "general insect chat" when topic is undefined', () => {
    const result = buildSystemPrompt(larva, undefined, 'en');
    expect(result).toContain('general insect chat');
  });

  it('U-TCA-sysprompt-05: injects threadSummary when provided', () => {
    const summary = 'User discussed Honey Bees and asked about pollinator traits.';
    const result = buildSystemPrompt(larva, undefined, 'en', summary);
    expect(result).toContain(summary);
    expect(result).toContain('Earlier conversation summary');
  });

  it('U-TCA-sysprompt-06: does NOT inject summary section when threadSummary is undefined', () => {
    const result = buildSystemPrompt(larva, undefined, 'en', undefined);
    expect(result).not.toContain('Earlier conversation summary');
  });

  it('U-TCA-sysprompt-07: does NOT inject summary section when threadSummary is empty string', () => {
    const result = buildSystemPrompt(larva, undefined, 'en', '');
    expect(result).not.toContain('Earlier conversation summary');
  });
});

// ---------------------------------------------------------------------------
// toMessages
// ---------------------------------------------------------------------------

const makeHistory = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    text: `message ${i + 1}`,
  }));

describe('toMessages (U-TCA-msgs-*)', () => {
  it('U-TCA-msgs-01: appends user message as last entry', () => {
    const result = toMessages([], 'Hello', false);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('U-TCA-msgs-02: without summary uses full 12-turn window', () => {
    const history = makeHistory(20);
    const result = toMessages(history, 'new', false);
    // 12 from history + 1 user = 13
    expect(result).toHaveLength(13);
    // Should be the last 12 turns
    expect(result[0]!.content).toBe('message 9');
  });

  it('U-TCA-msgs-03: with summary uses compressed 4-turn window', () => {
    const history = makeHistory(20);
    const result = toMessages(history, 'new', true);
    // 4 from history + 1 user = 5
    expect(result).toHaveLength(5);
    // Should be the last 4 turns
    expect(result[0]!.content).toBe('message 17');
  });

  it('U-TCA-msgs-04: with summary window is smaller than without', () => {
    const history = makeHistory(15);
    const withoutSummary = toMessages(history, 'q', false);
    const withSummary = toMessages(history, 'q', true);
    expect(withSummary.length).toBeLessThan(withoutSummary.length);
  });

  it('U-TCA-msgs-05: filters out blank history turns', () => {
    const history = [
      { role: 'user' as const, text: 'hello' },
      { role: 'assistant' as const, text: '   ' }, // blank
      { role: 'user' as const, text: 'world' },
    ];
    const result = toMessages(history, 'new', false);
    // blank turn should be dropped
    expect(result.every((m) => m.content.trim().length > 0)).toBe(true);
  });

  it('U-TCA-msgs-06: history shorter than window returns all turns + user msg', () => {
    const history = makeHistory(3);
    const result = toMessages(history, 'x', false);
    expect(result).toHaveLength(4); // 3 + user
  });

  it('U-TCA-msgs-07: empty history returns only user message', () => {
    const result = toMessages([], 'only msg', true);
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe('user');
  });
});
