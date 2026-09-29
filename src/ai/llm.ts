/**
 * On-device LLM runtime for chat.
 *
 * `llamaRnRuntime` wraps `llama.rn` (a `llama.cpp` port for React Native) and
 * runs Gemma 4 E2B (see chatModel.ts for the file and its download). Messages
 * go through the chat template embedded in the GGUF (jinja), so the prompt
 * format always matches the model. Personas are system prompts; there are no
 * per-persona adapters. Metal on iOS, CPU/NEON on Android. There is no mock:
 * without the model, chat is disabled (see Chat.tsx).
 */

import type { Persona } from '@/personas';

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type CompleteOpts = {
  /** Hard cap on generated tokens. */
  maxTokens?: number;
  /** Standard sampling knob, `0` = deterministic. */
  temperature?: number;
  /** Abort hook: stops native generation. */
  signal?: AbortSignal;
};

export interface LlmRuntime {
  /** Load the GGUF weights. Idempotent. */
  load(modelPath: string): Promise<void>;
  /** Streamed chat completion; yields text as the model produces it. */
  complete(messages: LlmMessage[], opts?: CompleteOpts): AsyncIterable<string>;
  /** Free the model (~3 GB of RAM for Gemma 4 E2B). */
  unload(): Promise<void>;
  /** `true` after `load()` resolves. */
  ready(): boolean;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pl: 'Polish',
  de: 'German',
  es: 'Spanish',
};

/** How many earlier turns go into the prompt (the context is 4k tokens). */
export const HISTORY_TURNS = 8;

/**
 * Chat messages for one reply: the persona as the system message (plus the
 * reply language and optional topic), the last few turns, then the user's
 * new message.
 */
export function buildMessages(opts: {
  persona: Persona;
  userText: string;
  language: string;
  topic?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
}): LlmMessage[] {
  const lang = LANGUAGE_NAMES[opts.language] ?? 'English';
  const system = [
    opts.persona.systemPrompt,
    `Always reply in ${lang}. Keep replies short: two or three sentences.`,
    opts.topic ? `The conversation is about: ${opts.topic}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  // Chat templates expect user/assistant turns to alternate, starting with
  // the user: drop leading assistant turns (the persona's greeting) and merge
  // back-to-back turns from the same side.
  const turns: LlmMessage[] = [];
  for (const h of (opts.history ?? []).slice(-HISTORY_TURNS)) {
    const text = h.text.trim();
    if (!text || (turns.length === 0 && h.role === 'assistant')) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === h.role) last.content += `\n\n${text}`;
    else turns.push({ role: h.role, content: text });
  }
  if (turns[turns.length - 1]?.role === 'user') turns.pop(); // unanswered; the new message follows
  return [{ role: 'system', content: system }, ...turns, { role: 'user', content: opts.userText }];
}

// ──────────────────────────────────────────────────────────────────────────
// llama.rn implementation
// ──────────────────────────────────────────────────────────────────────────

// Minimal local type — avoids a static import that would crash Metro when the
// native module hasn't been linked yet. Mirrors the public llama.rn surface.
type LlamaCtx = {
  completion(
    params: {
      messages: LlmMessage[];
      jinja?: boolean;
      enable_thinking?: boolean;
      n_predict?: number;
      temperature?: number;
      top_p?: number;
    },
    callback?: (data: { token: string }) => void,
  ): Promise<{ text: string }>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
};

let _ctx: LlamaCtx | null = null;

export const llamaRnRuntime: LlmRuntime = {
  async load(modelPath: string) {
    if (_ctx) return;
    // Dynamic import so the app doesn't crash on platforms where the native
    // module isn't linked (Expo Go, web, CI). Load fails gracefully instead.
    let initLlama: (params: {
      model: string;
      n_ctx?: number;
      n_batch?: number;
      n_threads?: number;
      n_gpu_layers?: number;
    }) => Promise<LlamaCtx>;
    try {
      ({ initLlama } = await import('llama.rn') as { initLlama: typeof initLlama });
    } catch {
      throw new Error(
        'llama.rn native module not available. Run `pnpm install` and rebuild the native app.',
      );
    }
    _ctx = await initLlama({
      model: modelPath,
      n_ctx: 4096,
      n_batch: 512,
      n_threads: 4,
      n_gpu_layers: 99, // Metal on iOS; silently capped to 0 on Android without Vulkan
    });
  },

  async *complete(messages: LlmMessage[], opts?: CompleteOpts): AsyncIterable<string> {
    if (!_ctx) throw new Error('llamaRnRuntime: call load() before complete()');
    const ctx = _ctx;

    // Bridge the callback-based llama.rn API into an async generator using a
    // simple token queue. Each partial token wakes the generator via a promise
    // resolver so we yield as fast as the model produces.
    const queue: string[] = [];
    let wake: (() => void) | null = null;
    let done = false;
    let completionErr: unknown;

    const completionPromise = ctx
      .completion(
        {
          messages,
          jinja: true, // use the chat template embedded in the GGUF
          enable_thinking: false, // short persona replies; no reasoning pass
          n_predict: opts?.maxTokens ?? 256,
          temperature: opts?.temperature ?? 0.8,
          top_p: 0.95,
        },
        (data: { token: string }) => {
          queue.push(data.token);
          wake?.();
          wake = null;
        },
      )
      .then(() => {
        done = true;
        wake?.();
        wake = null;
      })
      .catch((e: unknown) => {
        completionErr = e;
        done = true;
        wake?.();
        wake = null;
      });

    // Stop native generation on abort; remaining queued tokens still drain.
    opts?.signal?.addEventListener('abort', () => {
      ctx.stopCompletion().catch(() => {});
    });

    while (!done || queue.length > 0) {
      if (queue.length === 0 && !done) {
        await new Promise<void>((r) => {
          wake = r;
        });
      }
      while (queue.length > 0) {
        yield queue.shift()!;
      }
    }

    await completionPromise.catch(() => {});
    if (completionErr && !opts?.signal?.aborted) throw completionErr;
  },

  async unload() {
    if (_ctx) {
      await _ctx.release();
      _ctx = null;
    }
  },

  ready() {
    return _ctx !== null;
  },
};
