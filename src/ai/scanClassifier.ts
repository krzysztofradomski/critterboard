import type { ClassifyOptions, Candidate, VisionClassifier, VisionFrame } from '@/ai/vision';
import type { ExecutorchState } from '@/ai/executorchVision';

export type ScanClassifyFn = (
  frame: VisionFrame,
  opts?: ClassifyOptions,
) => Promise<Candidate[]>;

type ScanClassifierChoice = {
  useNativeVision: boolean;
  executorch: Pick<ExecutorchState, 'isReady' | 'classify'>;
  /** Web preview only (mock). Native builds pass none: no made-up results. */
  fallback?: VisionClassifier;
};

/**
 * Scan uses the ExecuTorch hook for real on-device inference. When the model
 * isn't loaded (no species pack yet, or still loading) there is nothing real
 * to classify with, so this returns null and Scan explains why, unless a
 * fallback was given (the web preview's mock).
 */
export function selectScanClassifier({
  useNativeVision,
  executorch,
  fallback,
}: ScanClassifierChoice): ScanClassifyFn | null {
  if (useNativeVision && executorch.isReady) return executorch.classify;
  return fallback ? fallback.classify.bind(fallback) : null;
}
