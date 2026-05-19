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

const USE_NATIVE_VISION = false; // flip after `04_export.py` drops files into assets/models/
const USE_LLAMA_RN = false;      // flip after llama.rn is added + GGUF bundled

export const vision: VisionClassifier = USE_NATIVE_VISION ? nativeClassifier : mockClassifier;
export const llm: LlmRuntime = USE_LLAMA_RN ? llamaRnRuntime : mockRuntime;

export { mockClassifier, nativeClassifier } from '@/ai/vision';
export { mockRuntime, llamaRnRuntime, buildPrompt } from '@/ai/llm';
export type { Candidate, VisionClassifier, VisionFrame, ClassifyOptions } from '@/ai/vision';
export type { LlmRuntime, CompleteOpts } from '@/ai/llm';
