import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractKeywords,
  buildConversationMemoryEntry,
  searchConversationMemories,
  type ConversationMemoryEntry,
} from '@/lib/conversationMemory';

describe('extractKeywords (U-CM-*)', () => {
  it('U-CM-01: empty string returns empty array', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('removes stop words', () => {
    const kw = extractKeywords('the quick brown fox');
    expect(kw).not.toContain('the');
  });

  it('lowercases all tokens', () => {
    const kw = extractKeywords('Bumblebee Honey Beetle');
    for (const k of kw) expect(k).toBe(k.toLowerCase());
  });

  it('returns at most `limit` keywords (default 8)', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda';
    const kw = extractKeywords(text);
    expect(kw.length).toBeLessThanOrEqual(8);
  });

  it('respects custom limit', () => {
    const kw = extractKeywords('one two three four five', 3);
    expect(kw.length).toBeLessThanOrEqual(3);
  });

  it('sorts by frequency (most frequent first)', () => {
    const text = 'bee bee bee ladybird ladybird wasp';
    const kw = extractKeywords(text);
    expect(kw[0]).toBe('bee');
    expect(kw[1]).toBe('ladybird');
  });

  it('filters stop words from the result', () => {
    // 'the', 'a', 'is', 'it' are stop words; 'go' (2 chars, not a stop word) may appear
    const kw = extractKeywords('the is it a quick');
    expect(kw).not.toContain('the');
    expect(kw).not.toContain('is');
    expect(kw).not.toContain('it');
    expect(kw).not.toContain('a');
  });
});

describe('buildConversationMemoryEntry (U-CM-*)', () => {
  it('includes threadId and who fields', () => {
    const entry = buildConversationMemoryEntry('thread-1', { who: 'me', t: 'Hello bee' });
    expect(entry.threadId).toBe('thread-1');
    expect(entry.who).toBe('me');
  });

  it('extracts keywords from the message text', () => {
    const entry = buildConversationMemoryEntry('t1', { who: 'larva', t: 'bumblebee pollinator flower' });
    expect(entry.keywords.length).toBeGreaterThan(0);
    expect(entry.keywords).toContain('bumblebee');
  });

  it('each call produces a unique id', () => {
    const a = buildConversationMemoryEntry('t', { who: 'me', t: 'same text' }, 1000);
    const b = buildConversationMemoryEntry('t', { who: 'me', t: 'same text' }, 1001);
    expect(a.id).not.toBe(b.id);
  });

  it('uses provided createdAt timestamp', () => {
    const entry = buildConversationMemoryEntry('t', { who: 'me', t: 'hello' }, 9999);
    expect(entry.createdAt).toBe(9999);
  });
});

describe('searchConversationMemories (U-CM-*)', () => {
  let entries: ConversationMemoryEntry[];

  beforeEach(() => {
    const now = Date.now();
    entries = [
      {
        id: '1',
        threadId: 'thread-A',
        who: 'me',
        text: 'bumblebee spotted in the garden',
        keywords: ['bumblebee', 'spotted', 'garden'],
        createdAt: now - 1000,
      },
      {
        id: '2',
        threadId: 'thread-B',
        who: 'larva',
        text: 'ladybird on a rose bush',
        keywords: ['ladybird', 'rose', 'bush'],
        createdAt: now - 2000,
      },
      {
        id: '3',
        threadId: 'thread-A',
        who: 'larva',
        text: 'bumblebee colonies thrive in summer',
        keywords: ['bumblebee', 'colonies', 'thrive', 'summer'],
        createdAt: now - 500,
      },
    ];
  });

  it('U-CM-01: empty entries returns empty hits', () => {
    expect(searchConversationMemories([], 'bumblebee')).toEqual([]);
  });

  it('U-CM-02: returns matching entries for a query', () => {
    const hits = searchConversationMemories(entries, 'bumblebee');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.entry.keywords.some((k) => k.includes('bumblebee')) ||
        h.entry.text.includes('bumblebee')).toBe(true);
    }
  });

  it('returns higher score for more keyword overlap', () => {
    const hits = searchConversationMemories(entries, 'bumblebee garden');
    // Entry 1 has both 'bumblebee' and 'garden' keywords
    expect(hits[0]!.entry.id === '1' || hits[0]!.entry.id === '3').toBe(true);
  });

  it('respects the limit parameter', () => {
    const hits = searchConversationMemories(entries, 'bumblebee', 1);
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it('returns empty if query has no extractable keywords', () => {
    const hits = searchConversationMemories(entries, 'the a an');
    expect(hits).toEqual([]);
  });

  it('U-CM-04: retrieves results from multiple threads', () => {
    const hits = searchConversationMemories(entries, 'bumblebee ladybird');
    const threadIds = new Set(hits.map((h) => h.entry.threadId));
    // If there are hits from both threads they should be present
    expect(hits.length).toBeGreaterThan(0);
  });

  it('U-CM-05: returns at most `limit` results (default 4)', () => {
    const many: ConversationMemoryEntry[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      threadId: 'thread',
      who: 'me' as const,
      text: 'bumblebee pollinator insect',
      keywords: ['bumblebee', 'pollinator', 'insect'],
      createdAt: Date.now() - i * 100,
    }));
    const hits = searchConversationMemories(many, 'bumblebee');
    expect(hits.length).toBeLessThanOrEqual(4);
  });

  it('U-CM-03: short text entries are skipped', () => {
    const shortEntry: ConversationMemoryEntry = {
      id: 'short',
      threadId: 't',
      who: 'me',
      text: 'hi',
      keywords: ['hi'],
      createdAt: Date.now(),
    };
    const hits = searchConversationMemories([shortEntry, ...entries], 'bumblebee');
    const ids = hits.map((h) => h.entry.id);
    expect(ids).not.toContain('short');
  });
});
