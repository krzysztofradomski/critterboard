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
// llama.rn implementation (placeholder)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Stub for the production runtime. Wire this up once:
 *
 *   - `llama.rn` is added to package.json
 *   - `assets/models/gemma-3-1b-it-q4_k_m.gguf` is in the bundle
 *      (source: https://huggingface.co/google/gemma-3-1b-it-GGUF)
 *   - Per-persona LoRA adapters from training/personas/ are built and
 *     placed in `assets/models/{larva,snail,maywind}.gguf`
 *   - The 2 GB RAM guard in `index.ts` enables this branch
 *
 * Throws today. Keep `mockRuntime` selected in `index.ts` until the
 * native module ships.
 */
export const llamaRnRuntime: LlmRuntime = {
  async load() {
    throw new Error('llamaRnRuntime not wired yet. See docs/ml-roadmap.md § 2.2.');
  },
  complete() {
    throw new Error('llamaRnRuntime not wired yet. See docs/ml-roadmap.md § 2.2.');
  },
  async unload() {
    /* no-op */
  },
  ready() {
    return false;
  },
};
