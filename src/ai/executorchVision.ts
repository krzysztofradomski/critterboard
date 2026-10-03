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
 * shows an install-the-pack / model-loading message instead of guessing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClassificationModule } from 'react-native-executorch';

import { SCIENTIFIC_TO_BUG_ID } from '@/ai/classMap';
import { findBugByLatin } from '@/data/bugs';
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

/**
 * Model label (latin name) → app bug id. Installed region packs register
 * their species via mergeBugs(), so a pack's model can name any of them.
 * Labels with no known species are dropped rather than guessed.
 */
export function labelToBugId(label: string): string | undefined {
  return findBugByLatin(label)?.id ?? SCIENTIFIC_TO_BUG_ID[label];
}

// ── Model cache ────────────────────────────────────────────────────────────

type Module = ClassificationModule<Record<string, number>>;

/**
 * Loading the .pte (~88 MB) takes seconds, and Scan unmounts on every navigation, so the loaded
 * model outlives the screen: Scan → Result → Scan reuses it. It is freed RELEASE_AFTER_MS after
 * the last user lets go, so it doesn't sit in RAM next to the chat model all session.
 */
const RELEASE_AFTER_MS = 60_000;

type CacheEntry = {
  source: string | number;
  labelMap: Record<string, number>;
  module: Promise<Module>;
  users: number;
  releaseTimer: ReturnType<typeof setTimeout> | null;
};

let cache: CacheEntry | null = null;

function dropCache(): void {
  const entry = cache;
  if (!entry) return;
  cache = null;
  if (entry.releaseTimer) clearTimeout(entry.releaseTimer);
  void entry.module.then((m) => m.delete(), () => undefined);
}

/** Get (loading if needed) the model for this file + label map. Pair with `releaseModel`. */
export function acquireModel(
  source: string | number,
  labelMap: Record<string, number>,
  onProgress?: (p: number) => void,
): CacheEntry {
  // A new file or label map (region switch, pack update) replaces the old model.
  if (cache && (cache.source !== source || cache.labelMap !== labelMap)) dropCache();
  if (!cache) {
    const module = ClassificationModule.fromCustomModel<Record<string, number>>(
      source,
      { labelMap, preprocessorConfig: NORM_CONFIG },
      onProgress,
    );
    const entry: CacheEntry = { source, labelMap, module, users: 0, releaseTimer: null };
    // A failed load must not be cached: the next visit tries again.
    module.catch(() => {
      if (cache === entry) cache = null;
    });
    cache = entry;
  }
  cache.users += 1;
  if (cache.releaseTimer) clearTimeout(cache.releaseTimer);
  cache.releaseTimer = null;
  return cache;
}

export function releaseModel(entry: CacheEntry): void {
  if (cache !== entry) return; // already replaced (and freed)
  entry.users -= 1;
  if (entry.users > 0) return;
  entry.releaseTimer = setTimeout(() => {
    if (cache === entry && entry.users === 0) dropCache();
  }, RELEASE_AFTER_MS);
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useExecutorchClassifier(config: ExecutorchClassifierConfig): ExecutorchState {
  const { modelSource, labelMap, preventLoad = false } = config;

  const moduleRef        = useRef<Module | null>(null);
  const [isReady,          setIsReady]          = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error,            setError]            = useState<Error | null>(null);

  useEffect(() => {
    if (preventLoad || modelSource === null) return;

    let cancelled = false;
    setIsReady(false);
    setError(null);
    setDownloadProgress(0);

    const entry = acquireModel(modelSource, labelMap, (p) => {
      if (!cancelled) setDownloadProgress(p);
    });
    (async () => {
      try {
        const mod = await entry.module;
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
      moduleRef.current = null;
      setIsReady(false);
      releaseModel(entry);
    };
  // Re-load when the model source or label map changes (region switch, pack update).
  }, [preventLoad, modelSource, labelMap]);

  const classify = useCallback(
    async (frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]> => {
      if (!moduleRef.current || !isReady) return [];
      const topK = opts?.topK ?? 3;
      const scores = await moduleRef.current.forward(frame as string) as Record<string, number>;
      return Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .flatMap(([label, confidence]) => {
          const bugId = labelToBugId(label);
          return bugId ? [{ bugId, confidence }] : [];
        })
        .slice(0, topK);
    },
    [isReady],
  );

  return { classify, isReady, downloadProgress, error };
}
