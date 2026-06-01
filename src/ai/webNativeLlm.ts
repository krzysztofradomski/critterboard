/**
 * Browser-native LLM adapter using Chrome's Built-in AI (Prompt API).
 *
 * Chrome 127–147: `window.ai.languageModel` (origin trial / flag)
 * Chrome 148+:    `LanguageModel` global (shipped by default, Gemini Nano)
 *
 * Both shapes are detected and normalised below. The adapter degrades
 * cleanly in Firefox / Safari / older Chrome and surfaces a helpful
 * message inside the chat bubble instead of throwing.
 *
 * Spec: https://github.com/explainers-by-googlers/prompt-api
 * Chrome guide: https://developer.chrome.com/docs/ai/prompt-api
 */

import type { ChatAdapter, ChatReplyParams } from './chatAdapter';

// ─── Type declarations ───────────────────────────────────────────────────────

// Chrome 148+ standardised global
type LMAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface LMSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream<string>;
  destroy(): void;
}

interface LMCreateOptions {
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
}

interface LMFactory148 {
  availability(opts?: { expectedInputLength?: number }): Promise<LMAvailability>;
  create(opts?: LMCreateOptions): Promise<LMSession>;
}

// Chrome 127–147 origin-trial shape
type OTAvailability = 'readily' | 'after-download' | 'no';

interface LMFactory127 {
  capabilities(): Promise<{ available: OTAvailability }>;
  create(opts?: LMCreateOptions): Promise<LMSession>;
}

// ─── Access helpers ──────────────────────────────────────────────────────────

function getFactory148(): LMFactory148 | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  return (globalThis as Record<string, unknown>).LanguageModel as LMFactory148 | undefined;
}

function getFactory127(): LMFactory127 | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { ai?: { languageModel?: LMFactory127 } }).ai?.languageModel;
}

// ─── Availability check ──────────────────────────────────────────────────────

export type WebNativeLlmStatus =
  | 'readily'       // model on-device, ready to go
  | 'after-download' // API present but model needs a download
  | 'unavailable';  // browser doesn't support the API at all

export async function checkWebNativeLlmStatus(): Promise<WebNativeLlmStatus> {
  const f148 = getFactory148();
  if (f148) {
    try {
      const status = await f148.availability();
      if (status === 'available') return 'readily';
      if (status === 'downloadable' || status === 'downloading') return 'after-download';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  const f127 = getFactory127();
  if (f127) {
    try {
      const cap = await f127.capabilities();
      if (cap.available === 'no') return 'unavailable';
      return cap.available === 'after-download' ? 'after-download' : 'readily';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

// Gemini Nano has a ~4 K-token context; keep the system prompt tight.
function buildNanoSystemPrompt(params: ChatReplyParams): string {
  return [
    params.persona.systemPrompt,
    '',
    'You are inside Critterboard, an insect ID app.',
    `Reply in: ${params.userContext.language}. Be concise (1–3 sentences) unless asked for depth.`,
    ...(params.topic ? [`Topic: ${params.topic}`] : []),
  ].join('\n');
}

function buildNanoUserTurn(params: ChatReplyParams): string {
  const ctx = params.history
    .slice(-4)
    .filter((h) => h.text.trim().length > 0)
    .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
    .join('\n');
  return ctx ? `${ctx}\nUser: ${params.userText}` : params.userText;
}

// ─── Session factory ─────────────────────────────────────────────────────────

async function createSession(systemPrompt: string): Promise<LMSession> {
  const f148 = getFactory148();
  if (f148) return f148.create({ systemPrompt, temperature: 0.7 });

  const f127 = getFactory127();
  if (f127) return f127.create({ systemPrompt, temperature: 0.7 });

  throw new Error('no-web-native-llm');
}

// ─── Stream reader ───────────────────────────────────────────────────────────

// ReadableStream in modern Chrome supports Symbol.asyncIterator, but
// TypeScript's lib.dom.d.ts doesn't declare it yet. Cast to AsyncIterable.
type AsyncStringIterable = AsyncIterable<string>;

// ─── Adapter ─────────────────────────────────────────────────────────────────

export const webNativeLlmChatAdapter: ChatAdapter = {
  async *streamReply(params: ChatReplyParams) {
    const status = await checkWebNativeLlmStatus();

    if (status === 'unavailable') {
      yield 'Gemini Nano is not available in this browser. Chrome 127+ with Built-in AI is required (check chrome://flags/#prompt-api-for-gemini-nano).';
      return;
    }

    if (status === 'after-download') {
      yield 'Gemini Nano is downloading to your device. Check back in a minute — it installs once and then works offline.';
      return;
    }

    let session: LMSession;
    try {
      session = await createSession(buildNanoSystemPrompt(params));
    } catch (err) {
      yield `Could not start on-device AI session: ${err instanceof Error ? err.message : 'unknown error'}`;
      return;
    }

    try {
      const stream = session.promptStreaming(buildNanoUserTurn(params));
      const reader = (stream as unknown as AsyncStringIterable)[Symbol.asyncIterator]
        ? (stream as unknown as AsyncStringIterable)
        : readableStreamToAsyncIterable(stream);

      for await (const chunk of reader) {
        if (params.signal?.aborted) return;
        if (chunk) yield chunk;
      }
    } finally {
      session.destroy();
    }
  },

  ready() {
    return Boolean(getFactory148() ?? getFactory127());
  },
};

// Fallback for browsers where ReadableStream doesn't implement AsyncIterator yet.
async function* readableStreamToAsyncIterable(
  stream: ReadableStream<string>,
): AsyncIterable<string> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
