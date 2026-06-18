import { useCallback } from "react";

import type { Candidate, ClassifyOptions, VisionFrame } from "@/ai/vision";

export type ExecutorchClassifierConfig = {
  modelSource: string | number | null;
  labelMap: Record<string, number>;
  preventLoad?: boolean;
};

export type ExecutorchState = {
  classify(frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]>;
  isReady: boolean;
  downloadProgress: number;
  error: Error | null;
};

/** Web stub — ExecuTorch is native-only. Scan falls back to cloud/mock vision. */
export function useExecutorchClassifier(
  _config: ExecutorchClassifierConfig,
): ExecutorchState {
  const classify = useCallback(async (): Promise<Candidate[]> => [], []);

  return {
    classify,
    isReady: false,
    downloadProgress: 0,
    error: null,
  };
}
