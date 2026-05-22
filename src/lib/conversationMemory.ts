type LocalChatMessage = {
  who: 'me' | 'larva';
  t: string;
};

export type ConversationMemoryEntry = {
  id: string;
  threadId: string;
  who: LocalChatMessage['who'];
  text: string;
  keywords: string[];
  createdAt: number;
};

export type MemorySearchHit = {
  entry: ConversationMemoryEntry;
  score: number;
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'did', 'do', 'does', 'for',
  'from', 'get', 'got', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'just', 'let', 'me', 'my', 'of', 'on', 'or', 'our', 'please', 'so', 'that', 'the', 'their',
  'them', 'there', 'they', 'this', 'to', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'who', 'why', 'will', 'with', 'you', 'your',
]);

function tokenize(input: string): string[] {
  return (input.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).filter((token) => !STOP_WORDS.has(token));
}

export function extractKeywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

export function buildConversationMemoryEntry(
  threadId: string,
  message: LocalChatMessage,
  createdAt = Date.now(),
): ConversationMemoryEntry {
  return {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    threadId,
    who: message.who,
    text: message.t,
    keywords: extractKeywords(message.t),
    createdAt,
  };
}

export function searchConversationMemories(
  entries: ConversationMemoryEntry[],
  query: string,
  limit = 4,
): MemorySearchHit[] {
  const queryTerms = extractKeywords(query, 10);
  if (queryTerms.length === 0) return [];
  const querySet = new Set(queryTerms);

  const scored = entries
    .map((entry) => {
      if (entry.text.trim().length < 2) return null;
      const overlap = entry.keywords.filter((k) => querySet.has(k)).length;
      const exactBoost = queryTerms.some((k) => entry.text.toLowerCase().includes(k)) ? 0.5 : 0;
      if (overlap === 0 && exactBoost === 0) return null;
      const ageHours = Math.max(0, (Date.now() - entry.createdAt) / (1000 * 60 * 60));
      const recencyBoost = Math.max(0, 1 - ageHours / (24 * 7));
      return { entry, score: overlap * 2 + exactBoost + recencyBoost };
    })
    .filter((v): v is MemorySearchHit => Boolean(v));

  scored.sort((a, b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt);
  return scored.slice(0, limit);
}
