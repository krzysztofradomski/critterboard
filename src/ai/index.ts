/**
 * Single switchboard for the AI seams. Everything runs on the device:
 *
 * Vision: ExecuTorch model from the installed region pack (Scan uses the
 *         `useExecutorchClassifier` hook). No pack → Scan asks the user to
 *         install one. The web preview can't run the model, so it uses the
 *         mock classifier as a clearly-labelled demo.
 * Chat:   Gemma 4 E2B via llama.rn, downloaded from Settings (chatModel.ts).
 *         Without it, chat is disabled; there is no scripted fallback, and
 *         the web preview has no chat.
 *
 * The cloud Gemini proof-of-concept was removed (see
 * docs/decisions/004-remove-cloud-gemini.md). See `docs/ml-roadmap.md`.
 */

import { mockClassifier, type VisionClassifier } from '@/ai/vision';
import { llamaRnRuntime, type LlmRuntime } from '@/ai/llm';
import { localLlmChatAdapter, type ChatAdapter } from '@/ai/chatAdapter';
import { withGuardrails } from '@/ai/guardrails';

// The .pte is NOT bundled — Settings → Regional packs downloads the file named
// in packs/eu-ce.json → modelUrl (e.g. packs/models/eu-1k-commercial-v1.pte).
export const USE_NATIVE_VISION = true;

/** Web-preview fallback only; native builds never classify with the mock. */
export const vision: VisionClassifier = mockClassifier;

export const llm: LlmRuntime = llamaRnRuntime;

// Guarded adapter used by Chat.tsx.
export const guardedLocalLlmChatAdapter: ChatAdapter = withGuardrails(localLlmChatAdapter);

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { useExecutorchClassifier } from '@/ai/executorchVision';
export { llamaRnRuntime, buildMessages } from '@/ai/llm';
export { localLlmChatAdapter } from '@/ai/chatAdapter';
export {
  CHAT_MODEL,
  chatModelState,
  subscribeChatModel,
  initChatModel,
  downloadChatModel,
  deleteChatModel,
  ejectChatModel,
  loadChatModel,
  memoryFit,
} from '@/ai/chatModel';
export { withGuardrails, checkInput, redactPii } from '@/ai/guardrails';
export type { GuardCode, GuardResult, GuardrailsConfig } from '@/ai/guardrails';
export type { ChatModelState, ChatModelStatus, MemoryFit } from '@/ai/chatModel';
export type { Candidate, VisionClassifier, VisionFrame, ClassifyOptions } from '@/ai/vision';
export type { ExecutorchState, ExecutorchClassifierConfig } from '@/ai/executorchVision';
export type { LlmRuntime, LlmMessage, CompleteOpts } from '@/ai/llm';
export type {
  ChatAdapter,
  ChatHistoryTurn,
  ChatMemorySnippet,
  ChatUserContext,
} from '@/ai/chatAdapter';
