/**
 * Single switchboard for the AI seams.
 *
 * Flip the flags below (or back them with a feature-flag service later)
 * to enable each real model once it's ready.
 *
 * Vision priority: native > gemini > mock
 * Chat priority:   local (device) > gemini > mock
 *
 * See `docs/ml-roadmap.md` for the full plan.
 */

import { mockClassifier, nativeClassifier, type VisionClassifier } from '@/ai/vision';
import { geminiVisionClassifier } from '@/ai/geminiVision';
import { llamaRnRuntime, mockRuntime, type LlmRuntime } from '@/ai/llm';
import { geminiChatAdapter, localLlmChatAdapter, mockChatAdapter, type ChatAdapter } from '@/ai/chatAdapter';

const USE_NATIVE_VISION = false;  // flip after 04_export.py drops files into assets/models/
const USE_GEMINI_VISION = true;   // cloud POC until on-device EfficientNetV2-S ships
const USE_LLAMA_RN = false;       // flip after llama.rn is added + GGUF bundled
const USE_CLOUD_GEMINI_POC = true; // temporary POC until on-device LLM ships
const HAS_GEMINI_API_KEY = Boolean(
  process.env.GEMINI_API_KEY ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY,
);

export const vision: VisionClassifier =
  USE_NATIVE_VISION ? nativeClassifier :
  USE_GEMINI_VISION && HAS_GEMINI_API_KEY ? geminiVisionClassifier :
  mockClassifier;

export const visionMode: 'native' | 'gemini' | 'mock' =
  USE_NATIVE_VISION ? 'native' :
  USE_GEMINI_VISION && HAS_GEMINI_API_KEY ? 'gemini' :
  'mock';

export const llm: LlmRuntime = USE_LLAMA_RN ? llamaRnRuntime : mockRuntime;
export const chatAdapter: ChatAdapter =
  USE_CLOUD_GEMINI_POC && HAS_GEMINI_API_KEY ? geminiChatAdapter : mockChatAdapter;
export const chatMode: 'gemini' | 'mock' =
  USE_CLOUD_GEMINI_POC && HAS_GEMINI_API_KEY ? 'gemini' : 'mock';

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { geminiVisionClassifier } from '@/ai/geminiVision';
export { mockRuntime, llamaRnRuntime, buildPrompt } from '@/ai/llm';
export { geminiChatAdapter, localLlmChatAdapter, mockChatAdapter } from '@/ai/chatAdapter';
export { webNativeLlmChatAdapter, checkWebNativeLlmStatus } from '@/ai/webNativeLlm';
export type { WebNativeLlmStatus } from '@/ai/webNativeLlm';
export type { Candidate, VisionClassifier, VisionFrame, ClassifyOptions } from '@/ai/vision';
export type { LlmRuntime, CompleteOpts } from '@/ai/llm';
export type {
  ChatAdapter,
  ChatHistoryTurn,
  ChatMemorySnippet,
  ChatUserContext,
} from '@/ai/chatAdapter';
