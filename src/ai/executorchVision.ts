/**
 * On-device classifier backed by react-native-executorch (ExecuTorch / .pte).
 *
 * Activation checklist:
 *   1. Run `python training/local/04_export.py --pte` to produce
 *      assets/models/insect_classifier.pte
 *   2. Set MODEL_SOURCE below to:
 *        require('../../assets/models/insect_classifier.pte')
 *      OR a hosted URL string for download-on-first-launch:
 *        'https://your-host/insect_classifier.pte'
 *   3. Flip USE_NATIVE_VISION = true in src/ai/index.ts
 *
 * Until MODEL_SOURCE is non-null this hook is a no-op: isReady stays false
 * and the Scan screen falls back to gemini/mock transparently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClassificationModule } from 'react-native-executorch';

import { SCIENTIFIC_TO_BUG_ID } from '@/ai/classMap';
import type { Candidate, ClassifyOptions, VisionFrame } from '@/ai/vision';

// ── Model asset ────────────────────────────────────────────────────────────
// Replace null with require('../../assets/models/insect_classifier.pte')
// once 04_export.py --pte has been run and the file placed in assets/models/.
const MODEL_SOURCE: string | number | null = null;

// ── Label map: scientific name → class index ───────────────────────────────
// Must match the ordering in training/local/checkpoints/class_map_lite.json.
const INSECT_LABELS = {
  'Palomena prasina':          0,
  'Coccinella septempunctata': 1,
  'Bombus hortorum':           2,
  'Apis mellifera':            3,
  'Vespula vulgaris':          4,
  'Vespa crabro':              5,
  'Gonepteryx rhamni':         6,
  'Bombus terrestris':         7,
  'Papilio machaon':           8,
  'Anthocharis cardamines':    9,
  'Pieris brassicae':          10,
  'Enallagma cyathigerum':     11,
  'Pieris rapae':              12,
  'Vanessa cardui':            13,
  'Vanessa atalanta':          14,
  'Aglais urticae':            15,
  'Aglais io':                 16,
  'Harmonia axyridis':         17,
  'Cetonia aurata':            18,
  'Lucanus cervus':            19,
} as const;

type InsectLabels = typeof INSECT_LABELS;

// ImageNet normalization — must match training/local/train_lite.py
const NORM_CONFIG = {
  normMean: [0.485, 0.456, 0.406] as [number, number, number],
  normStd:  [0.229, 0.224, 0.225] as [number, number, number],
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

export function useExecutorchClassifier(preventLoad = false): ExecutorchState {
  const moduleRef        = useRef<ClassificationModule<InsectLabels> | null>(null);
  const [isReady,          setIsReady]          = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error,            setError]            = useState<Error | null>(null);

  useEffect(() => {
    if (preventLoad || MODEL_SOURCE === null) return;

    let cancelled = false;
    setIsReady(false);
    setError(null);
    setDownloadProgress(0);

    (async () => {
      try {
        const mod = await ClassificationModule.fromCustomModel<InsectLabels>(
          MODEL_SOURCE as string | number,
          { labelMap: INSECT_LABELS, preprocessorConfig: NORM_CONFIG },
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
  }, [preventLoad]);

  const classify = useCallback(
    async (frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]> => {
      if (!moduleRef.current || !isReady) return [];
      const topK = opts?.topK ?? 3;
      // forward() returns { [scientificName]: score } for all 20 classes
      const scores = await moduleRef.current.forward(frame as string);
      return (Object.entries(scores) as [string, number][])
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
