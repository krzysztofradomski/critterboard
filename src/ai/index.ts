/**
 * Single switchboard for the AI seams. Everything runs on the device:
 *
 * Vision: ExecuTorch model from the installed region pack (Scan uses the
 *         `useExecutorchClassifier` hook). No pack → Scan asks the user to
 *         install one. The web preview can't run the model, so it uses the
 *         mock classifier as a clearly-labelled demo.
 * Chat:   on-device LLM (llama.rn on iOS/Android, Chrome's built-in model on
 *         web) when the user turns it on in Settings; otherwise the persona's
 *         scripted offline replies.
 *
 * The cloud Gemini proof-of-concept was removed (see
 * docs/decisions/004-remove-cloud-gemini.md). See `docs/ml-roadmap.md`.
 */

import { mockClassifier, type VisionClassifier } from '@/ai/vision';
import { llamaRnRuntime, mockRuntime, type LlmRuntime } from '@/ai/llm';
import { localLlmChatAdapter, mockChatAdapter, type ChatAdapter } from '@/ai/chatAdapter';
import { withGuardrails } from '@/ai/guardrails';
import { webNativeLlmChatAdapter } from '@/ai/webNativeLlm';

// The .pte is NOT bundled — Settings → Regional packs downloads the file named
// in packs/eu-ce.json → modelUrl (e.g. packs/models/eu-1k-commercial-v1.pte).
export const USE_NATIVE_VISION = true;
const USE_LLAMA_RN = true; // llama.rn wired; GGUF downloaded from Settings

/** Web-preview fallback only; native builds never classify with the mock. */
export const vision: VisionClassifier = mockClassifier;

export const llm: LlmRuntime = USE_LLAMA_RN ? llamaRnRuntime : mockRuntime;

// Guarded adapters used by Chat.tsx.
export const offlineChatAdapter: ChatAdapter = withGuardrails(mockChatAdapter);
export const guardedLocalLlmChatAdapter: ChatAdapter = withGuardrails(localLlmChatAdapter);
export const guardedWebNativeLlmChatAdapter: ChatAdapter = withGuardrails(webNativeLlmChatAdapter);

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { useExecutorchClassifier } from '@/ai/executorchVision';
export { mockRuntime, llamaRnRuntime, buildPrompt, MODEL_GGUF_FILENAME, MODEL_GGUF_HF_URL } from '@/ai/llm';
export { localLlmChatAdapter, mockChatAdapter } from '@/ai/chatAdapter';
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
