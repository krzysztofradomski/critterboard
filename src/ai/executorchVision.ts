/**
 * On-device classifier backed by react-native-executorch (ExecuTorch / .pte).
 *
 * Activation checklist:
 *   1. Install a regional pack from Settings — this downloads the pack JSON
 *      (containing the labelMap) and the .pte model file.
 *   2. Flip USE_NATIVE_VISION = true in src/ai/index.ts
 *
 * The hook accepts modelSource + labelMap as parameters so each region pack
 * can carry its own trained model and class mapping. Until modelSource is
 * non-null the hook is a no-op: isReady stays false and Scan falls back to
 * gemini/mock transparently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClassificationModule } from 'react-native-executorch';

import { SCIENTIFIC_TO_BUG_ID } from '@/ai/classMap';
import type { Candidate, ClassifyOptions, VisionFrame } from '@/ai/vision';

// ImageNet normalization — must match training/local/train_lite.py
const NORM_CONFIG = {
  normMean: [0.485, 0.456, 0.406] as [number, number, number],
  normStd:  [0.229, 0.224, 0.225] as [number, number, number],
};

// ── Config ─────────────────────────────────────────────────────────────────

export type ExecutorchClassifierConfig = {
  /**
   * Filesystem path or remote URL for the .pte model file.
   * null → hook is a no-op (isReady stays false).
   */
  modelSource: string | number | null;
  /** scientific name → class index, must match the model's output layer. */
  labelMap: Record<string, number>;
  /** When true the hook skips loading even if modelSource is non-null. */
  preventLoad?: boolean;
};

// ── Public types ───────────────────────────────────────────────────────────

export type ExecutorchState = {
  classify(frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]>;
  /** True once the .pte is loaded and warm. */
  isReady: boolean;
  /** 0–1 download progress while fetching a remote .pte. */
  downloadProgress: number;
  /** Set when model loading fails; the Scan screen falls back to cloud/mock. */
  error: Error | null;
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useExecutorchClassifier(config: ExecutorchClassifierConfig): ExecutorchState {
  const { modelSource, labelMap, preventLoad = false } = config;

  const moduleRef        = useRef<ClassificationModule<Record<string, number>> | null>(null);
  const [isReady,          setIsReady]          = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error,            setError]            = useState<Error | null>(null);

  useEffect(() => {
    if (preventLoad || modelSource === null) return;

    let cancelled = false;
    setIsReady(false);
    setError(null);
    setDownloadProgress(0);

    (async () => {
      try {
        const mod = await ClassificationModule.fromCustomModel<Record<string, number>>(
          modelSource as string | number,
          { labelMap, preprocessorConfig: NORM_CONFIG },
          (p) => { if (!cancelled) setDownloadProgress(p); },
        );
        if (!cancelled) {
          moduleRef.current = mod;
          setIsReady(true);
          setDownloadProgress(1);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      }
    })();

    return () => {
      cancelled = true;
      moduleRef.current?.delete();
      moduleRef.current = null;
      setIsReady(false);
    };
  // Re-load when the model source or label map changes (region switch).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preventLoad, modelSource]);

  const classify = useCallback(
    async (frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]> => {
      if (!moduleRef.current || !isReady) return [];
      const topK = opts?.topK ?? 3;
      const scores = await moduleRef.current.forward(frame as string) as Record<string, number>;
      return (Object.entries(scores))
        .map(([label, confidence]) => ({
          bugId: SCIENTIFIC_TO_BUG_ID[label] ?? 'lady',
          confidence,
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, topK);
    },
    [isReady],
  );

  return { classify, isReady, downloadProgress, error };
}
