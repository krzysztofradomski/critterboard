/**
 * Single switchboard for the AI seams.
 *
 * Today both seams resolve to their mock implementations. Flip the flags
 * below (or back them with a feature-flag service later) to enable the
 * real models once they're wired up.
 *
 * See `docs/ml-roadmap.md` for the full plan.
 */

import { mockClassifier, nativeClassifier, type VisionClassifier } from '@/ai/vision';
import { llamaRnRuntime, mockRuntime, type LlmRuntime } from '@/ai/llm';
import { geminiChatAdapter, mockChatAdapter, type ChatAdapter } from '@/ai/chatAdapter';

const USE_NATIVE_VISION = false; // flip after `04_export.py` drops files into assets/models/
const USE_LLAMA_RN = false;      // flip after llama.rn is added + GGUF bundled
const USE_CLOUD_GEMINI_POC = true; // temporary POC until on-device LLM ships
const HAS_GEMINI_API_KEY = Boolean(
  process.env.GEMINI_API_KEY ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY,
);

export const vision: VisionClassifier = USE_NATIVE_VISION ? nativeClassifier : mockClassifier;
export const llm: LlmRuntime = USE_LLAMA_RN ? llamaRnRuntime : mockRuntime;
export const chatAdapter: ChatAdapter =
  USE_CLOUD_GEMINI_POC && HAS_GEMINI_API_KEY ? geminiChatAdapter : mockChatAdapter;
export const chatMode: 'gemini' | 'mock' =
  USE_CLOUD_GEMINI_POC && HAS_GEMINI_API_KEY ? 'gemini' : 'mock';

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { mockRuntime, llamaRnRuntime, buildPrompt } from '@/ai/llm';
export { geminiChatAdapter, mockChatAdapter } from '@/ai/chatAdapter';
export type { Candidate, VisionClassifier, VisionFrame, ClassifyOptions } from '@/ai/vision';
export type { LlmRuntime, CompleteOpts } from '@/ai/llm';
export type {
  ChatAdapter,
  ChatHistoryTurn,
  ChatMemorySnippet,
  ChatUserContext,
} from '@/ai/chatAdapter';
