import { mockRuntime } from '@/ai/llm';
import type { Persona } from '@/personas';

/**
 * Back-compat shim for the previous `complete(persona, text)` API used by
 * Chat.tsx. New screens should consume `llm` from `src/ai/index.ts`
 * directly so they can stream tokens. This function preserves the
 * single-shot "await reply" contract for now.
 *
 * Behaviour matches the original mock exactly:
 *   - ~20% of calls throw, exercising the canned-fallback branch in Chat.
 *   - Otherwise we return a single canned line biased by keywords.
 *
 * When `USE_LLAMA_RN = true` in `src/ai/index.ts`, swap this to consume
 * `llm.complete(buildPrompt(...))` and concatenate the streamed chunks.
 */
export async function complete(persona: Persona, userText: string): Promise<string> {
  let combined = '';
  for await (const chunk of mockRuntime.completeWithPersona(persona, userText)) {
    combined += chunk;
  }
  return combined;
}
