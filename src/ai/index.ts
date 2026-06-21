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
import { toolChatAdapter } from '@/ai/toolChatAdapter';
import { withGuardrails } from '@/ai/guardrails';
import { webNativeLlmChatAdapter } from '@/ai/webNativeLlm';

// Native on-device vision is active. The .pte is NOT bundled — it's downloaded
// on demand from the brains/region-pack page (Settings → pack install pulls the
// GitHub release asset named in packs/eu-ce.json → modelUrl). This flag stays
// dormant (preventLoad) until a pack is installed; until then Scan falls back to
// gemini/mock. See packs/eu-ce.json and src/data/regionPacks.ts.
export const USE_NATIVE_VISION = true;
const USE_GEMINI_VISION = true;
const USE_LLAMA_RN = true;        // llama.rn wired; model downloaded on first launch
const USE_CLOUD_GEMINI_POC = true; // temporary POC until on-device LLM ships
const HAS_GEMINI_API_KEY = Boolean(
  process.env.GEMINI_API_KEY ??
    (process.env.NODE_ENV !== 'production' ? process.env.EXPO_PUBLIC_GEMINI_API_KEY : undefined),
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
// Tool-based adapter is the default cloud path — the model fetches live state
// via tools rather than receiving a fat system-prompt blob. Falls back to the
// legacy geminiChatAdapter only as a reference; mock when no API key.
export const chatAdapter: ChatAdapter = withGuardrails(
  USE_CLOUD_GEMINI_POC && HAS_GEMINI_API_KEY ? toolChatAdapter : mockChatAdapter,
);
export const chatMode: 'gemini' | 'mock' =
  USE_CLOUD_GEMINI_POC && HAS_GEMINI_API_KEY ? 'gemini' : 'mock';

// Guarded singletons for the on-device adapters used in Chat.tsx.
// These share the same guardrails config as the cloud adapter above.
export const guardedLocalLlmChatAdapter: ChatAdapter = withGuardrails(localLlmChatAdapter);
export const guardedWebNativeLlmChatAdapter: ChatAdapter = withGuardrails(webNativeLlmChatAdapter);

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { useExecutorchClassifier } from '@/ai/executorchVision';
export { geminiVisionClassifier } from '@/ai/geminiVision';
export { mockRuntime, llamaRnRuntime, buildPrompt, MODEL_GGUF_FILENAME, MODEL_GGUF_HF_URL } from '@/ai/llm';
export { geminiChatAdapter, localLlmChatAdapter, mockChatAdapter } from '@/ai/chatAdapter';
export { toolChatAdapter, createToolChatAdapter } from '@/ai/toolChatAdapter';
export { buildChatTools } from '@/ai/tools';
export { webNativeLlmChatAdapter, checkWebNativeLlmStatus } from '@/ai/webNativeLlm';
export { withGuardrails, checkInput, redactPii } from '@/ai/guardrails';
export type { GuardCode, GuardResult, GuardrailsConfig } from '@/ai/guardrails';
export type { WebNativeLlmStatus } from '@/ai/webNativeLlm';
export type { Candidate, VisionClassifier, VisionFrame, ClassifyOptions } from '@/ai/vision';
export type { ExecutorchState, ExecutorchClassifierConfig } from '@/ai/executorchVision';
export type { LlmRuntime, CompleteOpts } from '@/ai/llm';
export type {
  ChatAdapter,
  ChatHistoryTurn,
  ChatMemorySnippet,
  ChatUserContext,
} from '@/ai/chatAdapter';
export type { ToolContext, ChatTools } from '@/ai/tools';
