/**
 * Local LLM seam.
 *
 * The Chat screen calls `complete()` and streams tokens straight into the
 * bubble. Two implementations live behind this interface:
 *
 *   1. `mockRuntime`  — current default. Picks a canned line keyword-biased
 *      by the user's input and yields it as one chunk after a short delay.
 *
 *   2. `llamaRnRuntime` — production. Wraps `llama.rn` (a `llama.cpp` port
 *      for React Native). Loads `gemma-3-1b-it-q4_k_m.gguf` from the app
 *      bundle plus optional per-persona LoRA adapters (~15 MB each). Runs
 *      Metal/GPU acceleration on iOS, NEON on Android.
 *
 * The seam intentionally mirrors `llama.rn`'s streaming API so swapping the
 * production runtime is a single import in `src/ai/index.ts`. See
 * `docs/ml-roadmap.md` § Track 2.
 */

import type { Persona } from '@/personas';

export type CompleteOpts = {
  /** Hard cap on tokens. Defaults vary per runtime; mock ignores it. */
  maxTokens?: number;
  /** Standard sampling knob, `0` = deterministic. */
  temperature?: number;
  /** Abort hook. The mock checks `signal.aborted` between chunks. */
  signal?: AbortSignal;
};

export interface LlmRuntime {
  /**
   * Lazily load the GGUF weights. No-op for the mock impl. Idempotent —
   * calling twice with the same path returns the same handle.
   */
  load(modelPath: string): Promise<void>;

  /**
   * Streamed completion. Caller `for await`s the iterable and appends each
   * chunk to the UI live. Mock yields one chunk; real runtime yields one
   * per token.
   */
  complete(prompt: string, opts?: CompleteOpts): AsyncIterable<string>;

  /** Free the model. Call on app background to reclaim ~670 MB of RAM. */
  unload(): Promise<void>;

  /** `true` after `load()` resolves. */
  ready(): boolean;
}

/**
 * Build a persona-flavoured prompt using Gemma 3's chat template.
 *
 * Gemma 3 1B-IT uses `<start_of_turn>` / `<end_of_turn>` markers.
 * The system persona is placed in the `system` turn; llama.cpp passes it
 * through verbatim when using the raw `complete()` API.
 *
 * If llama.rn exposes a `chat()` method that reads the template from the
 * GGUF tokenizer config, prefer that and drop this builder — keeping it
 * here only for the raw-text path.
 */
export function buildPrompt(persona: Persona, userText: string, topic?: string): string {
  const opener = topic
    ? `We're talking about: ${topic}. The user just said: "${userText}"`
    : userText;
  return (
    `<start_of_turn>system\n${persona.systemPrompt}<end_of_turn>\n` +
    `<start_of_turn>user\n${opener}<end_of_turn>\n` +
    `<start_of_turn>model\n`
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mock implementation
// ──────────────────────────────────────────────────────────────────────────

/**
 * Picks a canned line from the persona, biased by surface keywords in the
 * user's text. Mirrors the previous behaviour of `src/ai/chat.ts` so the
 * Chat screen renders the same content whether or not the model is loaded.
 *
 * The bias logic is fully synchronous; the artificial delay just makes the
 * typing indicator visible. Real runtime replaces this entirely.
 */
async function* mockComplete(
  persona: Persona,
  userText: string,
  opts: CompleteOpts | undefined,
): AsyncIterable<string> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 900));
  if (opts?.signal?.aborted) return;

  // ~20% "timeout" rate to exercise the chat screen's fallback path.
  if (Math.random() < 0.2) {
    throw new Error('mock-timeout');
  }

  const text = userText.toLowerCase();
  const idx =
    text.includes('bee') || text.includes('wasp') || text.includes('hornet')
      ? 4
      : text.includes('hover')
      ? 1
      : text.includes('photo') || text.includes('blurry')
      ? 3
      : Math.floor(Math.random() * persona.canned.length);
  yield persona.canned[idx % persona.canned.length]!;
}

export const mockRuntime: LlmRuntime & {
  /**
   * Convenience for callers that don't need streaming — preserves the
   * old `complete()` contract used by Chat.tsx before the seam landed.
   */
  completeWithPersona(persona: Persona, userText: string, topic?: string): AsyncIterable<string>;
} = {
  async load() {
    // no-op
  },
  // The "raw" prompt API mostly exists for the production runtime; the
  // mock just routes back through `completeWithPersona`. We keep this
  // method so the seam matches `llama.rn` exactly.
  complete(_prompt) {
    throw new Error('mockRuntime.complete is not used directly. Call completeWithPersona instead.');
  },
  async unload() {
    // no-op
  },
  ready() {
    return true;
  },
  completeWithPersona(persona, userText, _topic) {
    return mockComplete(persona, userText, undefined);
  },
};

// ──────────────────────────────────────────────────────────────────────────
// llama.rn implementation
// ──────────────────────────────────────────────────────────────────────────

// Minimal local type — avoids a static import that would crash Metro when the
// native module hasn't been linked yet. Mirrors the public llama.rn surface.
type LlamaCtx = {
  completion(
    params: {
      prompt: string;
      n_predict?: number;
      temperature?: number;
      top_p?: number;
      stop?: string[];
      emit_partial_completion?: boolean;
    },
    callback?: (data: { token: string }) => void,
  ): Promise<{ text: string }>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
};

// Gemma 3 chat template stop tokens (matches buildPrompt above).
const GEMMA_STOP = ['<end_of_turn>', '<eos>'];

// Model asset — downloaded on first launch, not bundled (670 MB).
// See assets/models/README.md for the download source.
export const MODEL_GGUF_FILENAME = 'gemma-3-1b-it-q4_k_m.gguf';
export const MODEL_GGUF_HF_URL =
  'https://huggingface.co/google/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-q4_k_m.gguf';

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
        'llama.rn native module not available. Run `npm install llama.rn` and rebuild the native app.',
      );
    }
    _ctx = await initLlama({
      model: modelPath,
      n_ctx: 2048,
      n_batch: 512,
      n_threads: 4,
      n_gpu_layers: 99, // Metal on iOS; silently capped to 0 on Android without Vulkan
    });
  },

  async *complete(prompt: string, opts?: CompleteOpts): AsyncIterable<string> {
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
          prompt,
          n_predict: opts?.maxTokens ?? 512,
          temperature: opts?.temperature ?? 0.7,
          top_p: 0.9,
          stop: GEMMA_STOP,
          emit_partial_completion: true,
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
