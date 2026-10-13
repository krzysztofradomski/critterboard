/**
 * Single switchboard for the AI seams. Everything runs on the device:
 *
 * Vision: ExecuTorch model from the installed region pack (Scan uses the
 *         `useExecutorchClassifier` hook). No pack → Scan asks the user to
 *         install one. The web preview can't run the model, so it uses the
 *         mock classifier as a clearly-labelled demo.
 * Chat:   Apple Intelligence (Apple's on-device model, iOS 26+) via our own
 *         native module (appleChat.ts). Elsewhere (older iPhones, Android,
 *         web, the app in Polish) there is no chat and no scripted fallback.
 *
 * The cloud Gemini proof-of-concept was removed (see
 * docs/decisions/004-remove-cloud-gemini.md). See `docs/ml-roadmap.md`.
 */

import { mockClassifier, type VisionClassifier } from '@/ai/vision';
import { appleChatAdapter } from '@/ai/appleChat';
import type { ChatAdapter } from '@/ai/chatAdapter';
import { withGuardrails } from '@/ai/guardrails';

// The .pte is NOT bundled — Settings → Regional packs downloads the file named
// in packs/eu-ce.json → modelUrl (e.g. packs/models/eu-1k-field-v7-256.pte).
export const USE_NATIVE_VISION = true;

/** Web-preview fallback only; native builds never classify with the mock. */
export const vision: VisionClassifier = mockClassifier;

// Guarded adapter used by Chat.tsx.
export const guardedChatAdapter: ChatAdapter = withGuardrails(appleChatAdapter);

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { useExecutorchClassifier } from '@/ai/executorchVision';
export { buildPrompt, chatAvailability, chatOffered, AppleChatError } from '@/ai/appleChat';
export { withGuardrails, checkInput, redactPii } from '@/ai/guardrails';
export type { GuardCode, GuardResult, GuardrailsConfig } from '@/ai/guardrails';
export type { ChatAvailability } from '@/ai/appleChat';
export type { Candidate, VisionClassifier, VisionFrame, ClassifyOptions } from '@/ai/vision';
export type { ExecutorchState, ExecutorchClassifierConfig } from '@/ai/executorchVision';
export type {
  ChatAdapter,
  ChatHistoryTurn,
  ChatMemorySnippet,
  ChatUserContext,
} from '@/ai/chatAdapter';
