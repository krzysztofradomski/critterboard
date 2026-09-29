import { describe, expect, it } from 'vitest';

import { buildMessages, HISTORY_TURNS } from '@/ai/llm';
import type { Persona } from '@/personas';

const persona = { systemPrompt: 'You are Prof. Larva, a snarky bug expert.' } as Persona;

describe('buildMessages', () => {
  it('puts the persona, reply language and topic in the system message', () => {
    const [system] = buildMessages({ persona, userText: 'hi', language: 'pl', topic: 'Peacock' });
    expect(system!.role).toBe('system');
    expect(system!.content).toContain('Prof. Larva');
    expect(system!.content).toContain('Always reply in Polish');
    expect(system!.content).toContain('Peacock');
  });

  it('falls back to English for an unknown language', () => {
    const [system] = buildMessages({ persona, userText: 'hi', language: 'xx' });
    expect(system!.content).toContain('Always reply in English');
  });

  it('keeps the last turns, alternating user/assistant, ending with the new message', () => {
    const history = [
      { role: 'assistant' as const, text: 'Hello! (greeting)' },
      { role: 'user' as const, text: 'q1' },
      { role: 'assistant' as const, text: 'a1' },
      { role: 'assistant' as const, text: 'a1 more' },
      { role: 'user' as const, text: '  ' },
      { role: 'user' as const, text: 'q2 (unanswered)' },
    ];
    const msgs = buildMessages({ persona, userText: 'q3', language: 'en', history });
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(msgs[2]!.content).toBe('a1\n\na1 more');
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'q3' });
  });

  it('caps the history length', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `turn ${i}`,
    }));
    const msgs = buildMessages({ persona, userText: 'next', language: 'en', history });
    expect(msgs.length).toBeLessThanOrEqual(1 + HISTORY_TURNS + 1);
    expect(msgs[1]!.role).toBe('user');
  });
});
