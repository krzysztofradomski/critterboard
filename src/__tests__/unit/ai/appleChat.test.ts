import { describe, expect, it, vi } from 'vitest';

vi.mock('expo', () => ({ requireOptionalNativeModule: () => null }));

import {
  AppleChatError,
  buildPrompt,
  chatAvailability,
  chatOffered,
  HISTORY_TURNS,
  isOldChatFile,
  streamApple,
  type AppleChatNative,
} from '@/ai/appleChat';
import type { Persona } from '@/personas';

const persona = { systemPrompt: 'You are Prof. Larva, a snarky bug expert.' } as Persona;

/** A stand-in for the Swift module: records calls and lets a test fire its events. */
function fakeNative(availability = 'available') {
  const listeners: Record<string, ((e: never) => void)[]> = { onChunk: [], onDone: [], onError: [] };
  const calls = { start: [] as string[], stop: [] as string[] };
  const mod = {
    availability: () => availability,
    start: (id: string) => calls.start.push(id),
    stop: (id: string) => calls.stop.push(id),
    addListener: (event: string, fn: (e: never) => void) => {
      listeners[event]!.push(fn);
      return { remove: () => (listeners[event] = listeners[event]!.filter((f) => f !== fn)) };
    },
  } as unknown as AppleChatNative;
  const emit = (event: string, e: object) => listeners[event]!.forEach((f) => f(e as never));
  const live = () => Object.values(listeners).reduce((n, l) => n + l.length, 0);
  return { mod, calls, emit, live };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('chatAvailability', () => {
  it('passes a known state through and treats anything else as no chat', () => {
    expect(chatAvailability('en', fakeNative('available').mod)).toBe('available');
    expect(chatAvailability('pl', fakeNative('language').mod)).toBe('language');
    expect(chatAvailability('en', fakeNative('weird').mod)).toBe('device');
    expect(chatAvailability('en', null)).toBe('device'); // Android, web, Expo Go
  });
  it('offers chat entry points only when chat works or the player can fix it', () => {
    expect(['available', 'notEnabled', 'notReady'].every((a) => chatOffered(a as never))).toBe(true);
    expect(chatOffered('language')).toBe(false);
    expect(chatOffered('device')).toBe(false);
  });
});

describe('buildPrompt', () => {
  it('puts the persona, reply language and topic in the instructions', () => {
    const { instructions, prompt } = buildPrompt({ persona, userText: 'hi', language: 'de', topic: 'Peacock' });
    expect(instructions).toContain('Prof. Larva');
    expect(instructions).toContain('Always reply in German');
    expect(instructions).toContain('Peacock');
    expect(prompt).toBe('hi');
  });
  it('falls back to English for an unknown language', () => {
    expect(buildPrompt({ persona, userText: 'hi', language: 'xx' }).instructions).toContain('Always reply in English');
  });
  it('puts the last turns before the new message, skipping empty ones', () => {
    const history = [
      { role: 'assistant' as const, text: 'Hello!' },
      { role: 'user' as const, text: '  ' },
      { role: 'user' as const, text: 'q1' },
      { role: 'assistant' as const, text: 'a1' },
    ];
    const { prompt } = buildPrompt({ persona, userText: 'q2', language: 'en', history });
    expect(prompt).toBe("Conversation so far:\nYou: Hello!\nPlayer: q1\nYou: a1\n\nThe player's new message:\nq2");
  });
  it('caps the history length', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ role: 'user' as const, text: `turn ${i}` }));
    const { prompt } = buildPrompt({ persona, userText: 'next', language: 'en', history });
    expect(prompt.match(/^Player: /gm)).toHaveLength(HISTORY_TURNS);
    expect(prompt).toContain('turn 39');
    expect(prompt).not.toContain('turn 31\n');
  });
});

describe('streamApple', () => {
  it('turns cumulative snapshots into deltas and cleans up its listeners', async () => {
    const n = fakeNative();
    const out: string[] = [];
    const run = (async () => {
      for await (const d of streamApple(n.mod, { instructions: 'i', prompt: 'p' })) out.push(d);
    })();
    await tick();
    const id = n.calls.start[0]!;
    n.emit('onChunk', { id: 'other', text: 'not mine' });
    n.emit('onChunk', { id, text: 'Hel' });
    n.emit('onChunk', { id, text: 'Hello' });
    n.emit('onChunk', { id, text: 'Hello there' });
    n.emit('onDone', { id });
    await run;
    expect(out.join('')).toBe('Hello there');
    expect(n.live()).toBe(0);
    expect(n.calls.stop).toEqual([]);
  });

  it('keeps streaming after a snapshot that rewrites earlier text', async () => {
    const n = fakeNative();
    const out: string[] = [];
    const run = (async () => {
      for await (const d of streamApple(n.mod, { instructions: 'i', prompt: 'p' })) out.push(d);
    })();
    await tick();
    const id = n.calls.start[0]!;
    n.emit('onChunk', { id, text: 'Helo' });
    n.emit('onChunk', { id, text: 'Hello' }); // not a prefix: resync, no delta
    n.emit('onChunk', { id, text: 'Hello there' });
    n.emit('onDone', { id });
    await run;
    expect(out.join('')).toBe('Helo there');
  });

  it('throws a coded error, and stays quiet about it after an abort', async () => {
    const n = fakeNative();
    const it1 = streamApple(n.mod, { instructions: 'i', prompt: 'p' });
    const p1 = it1.next();
    await tick();
    n.emit('onError', { id: n.calls.start[0], code: 'guardrail' });
    await expect(p1).rejects.toEqual(new AppleChatError('guardrail'));

    const ctrl = new AbortController();
    const it2 = streamApple(n.mod, { instructions: 'i', prompt: 'p' }, ctrl.signal);
    const p2 = it2.next();
    await tick();
    const id2 = n.calls.start[1]!;
    ctrl.abort();
    expect(n.calls.stop).toContain(id2);
    n.emit('onError', { id: id2, code: 'other' });
    await expect(p2).resolves.toEqual({ done: true, value: undefined });
  });

  it('stops generation when the consumer leaves early', async () => {
    const n = fakeNative();
    const gen = streamApple(n.mod, { instructions: 'i', prompt: 'p' });
    const first = gen.next();
    await tick();
    const id = n.calls.start[0]!;
    n.emit('onChunk', { id, text: 'Hi' });
    expect((await first).value).toBe('Hi');
    await gen.return(undefined);
    expect(n.calls.stop).toEqual([id]);
    expect(n.live()).toBe(0);
  });
});

describe('isOldChatFile', () => {
  it('matches old chat weights and their record, never a vision pack', () => {
    expect(['Qwen3-1.7B-Q4_K_M.gguf', 'gemma-4-E2B-it-Q4_K_M.gguf.part', 'chat-model.json'].every(isOldChatFile)).toBe(true);
    expect(isOldChatFile('packs')).toBe(false);
    expect(isOldChatFile('eu-ce.pte')).toBe(false);
  });
});
