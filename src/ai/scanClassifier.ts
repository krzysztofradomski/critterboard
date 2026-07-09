import type { ClassifyOptions, Candidate, VisionClassifier, VisionFrame } from '@/ai/vision';
import type { ExecutorchState } from '@/ai/executorchVision';

export type ScanClassifyFn = (
  frame: VisionFrame,
  opts?: ClassifyOptions,
) => Promise<Candidate[]>;

type ScanClassifierChoice = {
  useNativeVision: boolean;
  executorch: Pick<ExecutorchState, 'isReady' | 'classify'>;
  fallback: VisionClassifier;
};

/**
 * Scan uses the ExecuTorch hook for real on-device inference. The exported
 * `vision` singleton is only the cloud/mock fallback, so unloaded native mode
 * must still route there instead of the placeholder native classifier.
 */
export function selectScanClassifier({
  useNativeVision,
  executorch,
  fallback,
}: ScanClassifierChoice): ScanClassifyFn {
  if (useNativeVision && executorch.isReady) return executorch.classify;
  return fallback.classify.bind(fallback);
}
