/**
 * Chat on Apple Intelligence: Apple's on-device model (Foundation Models, iOS 26+), through
 * our own native module (modules/apple-chat). Android, web, older iPhones and phones without
 * Apple Intelligence have no chat. Why: docs/decisions/009-apple-intelligence-chat.md.
 */
import { requireOptionalNativeModule } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';

import type { ChatAdapter, ChatHistoryTurn } from '@/ai/chatAdapter';
import type { Persona } from '@/personas';

/**
 * - `available`: chat works.
 * - `notEnabled`: Apple Intelligence is off in iOS Settings.
 * - `notReady`: iOS is still downloading Apple's model.
 * - `language`: Apple's model doesn't speak the app language (Polish, for now).
 * - `device`: no Apple Intelligence here (older iPhone, older iOS, Android, web).
 */
export type ChatAvailability = 'available' | 'notEnabled' | 'notReady' | 'language' | 'device';

type Sub = { remove(): void };
export type AppleChatNative = {
  availability(lang: string): string;
  start(id: string, instructions: string, prompt: string, temperature: number, maxTokens: number): void;
  stop(id: string): void;
  addListener(event: 'onChunk', fn: (e: { id: string; text: string }) => void): Sub;
  addListener(event: 'onDone', fn: (e: { id: string }) => void): Sub;
  addListener(event: 'onError', fn: (e: { id: string; code: string }) => void): Sub;
};

const native = requireOptionalNativeModule<AppleChatNative>('AppleChat');

const STATES: readonly ChatAvailability[] = ['available', 'notEnabled', 'notReady', 'language', 'device'];

export function chatAvailability(lang: string, mod: AppleChatNative | null = native): ChatAvailability {
  try {
    const s = mod?.availability(lang) as ChatAvailability | undefined;
    return s && STATES.includes(s) ? s : 'device';
  } catch {
    return 'device';
  }
}

/** Show chat entry points: chat works, or the player can fix what's missing in iOS Settings. */
export function chatOffered(a: ChatAvailability): boolean {
  return a === 'available' || a === 'notEnabled' || a === 'notReady';
}

/** A failed reply; `code` is guardrail | language | context | unavailable | other. */
export class AppleChatError extends Error {
  constructor(readonly code: string) {
    super(`apple chat: ${code}`);
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pl: 'Polish',
  de: 'German',
  es: 'Spanish',
};

/** How many earlier turns go into the prompt (Apple's context is 4k tokens). */
export const HISTORY_TURNS = 8;

/**
 * Instructions (the persona, reply language and topic) and the prompt (the last few turns,
 * then the new message) for one reply. Each reply is a fresh session, so the history goes in
 * as text.
 */
export function buildPrompt(opts: {
  persona: Persona;
  userText: string;
  language: string;
  topic?: string;
  history?: ChatHistoryTurn[];
}): { instructions: string; prompt: string } {
  const lang = LANGUAGE_NAMES[opts.language] ?? 'English';
  const instructions = [
    opts.persona.systemPrompt,
    `Always reply in ${lang}. Keep replies short: two or three sentences.`,
    opts.topic ? `The conversation is about: ${opts.topic}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const turns = (opts.history ?? [])
    .map((h) => ({ role: h.role, text: h.text.trim() }))
    .filter((h) => h.text)
    .slice(-HISTORY_TURNS);
  const prompt = turns.length
    ? `Conversation so far:\n${turns.map((h) => `${h.role === 'user' ? 'Player' : 'You'}: ${h.text}`).join('\n')}\n\nThe player's new message:\n${opts.userText}`
    : opts.userText;
  return { instructions, prompt };
}

let seq = 0;

/**
 * One streamed reply as text deltas. The native side sends cumulative snapshots; aborting
 * (or the consumer stopping early) stops generation.
 */
export async function* streamApple(
  mod: AppleChatNative,
  input: { instructions: string; prompt: string },
  signal?: AbortSignal,
  opts: { temperature?: number; maxTokens?: number } = {},
): AsyncGenerator<string> {
  const id = `r${++seq}`;
  const queue: string[] = [];
  let sent = '';
  let done = false;
  let error: string | null = null;
  let wake: (() => void) | null = null;
  const poke = () => {
    wake?.();
    wake = null;
  };
  const subs = [
    mod.addListener('onChunk', (e) => {
      if (e.id !== id) return;
      // ponytail: plain-text snapshots only grow; a rewritten one resyncs without re-diffing.
      if (e.text.startsWith(sent)) queue.push(e.text.slice(sent.length));
      sent = e.text;
      poke();
    }),
    mod.addListener('onDone', (e) => {
      if (e.id !== id) return;
      done = true;
      poke();
    }),
    mod.addListener('onError', (e) => {
      if (e.id !== id) return;
      error = e.code;
      done = true;
      poke();
    }),
  ];
  const onAbort = () => mod.stop(id);
  signal?.addEventListener('abort', onAbort);
  try {
    mod.start(id, input.instructions, input.prompt, opts.temperature ?? 0.8, opts.maxTokens ?? 300);
    for (;;) {
      while (queue.length) {
        const text = queue.shift()!;
        if (text) yield text;
      }
      if (done) break;
      await new Promise<void>((r) => {
        wake = r;
      });
    }
    if (error && !signal?.aborted) throw new AppleChatError(error);
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (!done) mod.stop(id);
    subs.forEach((s) => s.remove());
  }
}

export const appleChatAdapter: ChatAdapter = {
  async *streamReply(params) {
    if (!native) throw new AppleChatError('unavailable');
    const input = buildPrompt({
      persona: params.persona,
      userText: params.userText,
      language: params.userContext.language,
      topic: params.topic,
      history: params.history,
    });
    yield* streamApple(native, input, params.signal);
  },
  ready() {
    return native !== null;
  },
};

/** Files earlier builds' downloaded chat model left in models/ (GGUF weights, partial downloads, its record). */
export function isOldChatFile(name: string): boolean {
  return /\.gguf(\.part)?$/i.test(name) || name === 'chat-model.json';
}

/** Free the 1.1–3.1 GB an old chat model took. Vision packs live in models/packs/, untouched. */
export async function removeOldChatModels(): Promise<void> {
  const dir = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}models/` : null;
  if (!dir) return;
  const names = await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[]);
  for (const f of names.filter(isOldChatFile)) {
    await FileSystem.deleteAsync(`${dir}${f}`, { idempotent: true }).catch(() => undefined);
  }
}
