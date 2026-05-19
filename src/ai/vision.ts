/**
 * Vision classifier seam.
 *
 * The Scan screen calls `classify(frame)` and gets back ranked candidates.
 * Two implementations live behind this interface:
 *
 *   1. `mockClassifier`  — today's default. Mirrors the prototype's
 *      `nav.params.hint` behaviour so the rest of the app keeps working
 *      while the real model is still in training.
 *
 *   2. `nativeClassifier` — wraps the on-device EfficientNetV2-S exported
 *      by `training/local/04_export.py`. iOS reads the `.mlpackage` via
 *      CoreML/Vision; Android reads the `.onnx` via ONNX Runtime or
 *      `react-native-fast-tflite`. The TS surface is identical.
 *
 * Swap is one line in `src/ai/index.ts`. See `docs/ml-roadmap.md` § Track 1.
 */

import { BUGS } from '@/data/bugs';

/** Opaque handle to a camera frame. The mock impl never reads it. */
export type VisionFrame = unknown;

export type Candidate = {
  /** Matches an `id` in `src/data/bugs.ts`. */
  bugId: string;
  /** Softmax probability in [0, 1]. */
  confidence: number;
};

export type ClassifyOptions = {
  /** Maximum candidates to return. Defaults to 3 for the Disambiguate UX. */
  topK?: number;
  /**
   * Fallback hint, used by the mock impl. Native impls ignore this and
   * read the frame instead.
   */
  hint?: string;
};

export interface VisionClassifier {
  /** Async to keep the seam identical to the native CoreML/ONNX call. */
  classify(frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]>;

  /**
   * `true` once the model is loaded and warm. The mock impl is always
   * ready; native impls return `false` while the file is still mmap'ing.
   */
  ready(): boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Mock implementation
// ──────────────────────────────────────────────────────────────────────────

/**
 * Returns a top-3 around the supplied `hint` (defaults to `mona`), spreading
 * confidence between the legendary/uncommon/epic bands so the result and
 * disambiguation screens both have something believable to render.
 */
function mockTopK(hint: string, topK: number): Candidate[] {
  const primary = BUGS.find((b) => b.id === hint) ?? BUGS[0]!;
  // Sort the rest of the deck by visual similarity to the primary (we use
  // rarity as a cheap stand-in). In production this comes from the model's
  // own embeddings.
  const others = BUGS
    .filter((b) => b.id !== primary.id)
    .sort((a, b) => Math.abs(a.xp - primary.xp) - Math.abs(b.xp - primary.xp));

  const confidences = [0.94, 0.62, 0.31, 0.18, 0.09];
  const ranked: Candidate[] = [
    { bugId: primary.id, confidence: confidences[0]! },
    ...others.slice(0, topK - 1).map((b, i) => ({
      bugId: b.id,
      confidence: confidences[i + 1] ?? 0.05,
    })),
  ];
  return ranked.slice(0, topK);
}

export const mockClassifier: VisionClassifier = {
  async classify(_frame, opts) {
    const topK = opts?.topK ?? 3;
    const hint = opts?.hint ?? 'mona';
    // Tiny artificial delay so the loading state in Scan has time to render.
    await new Promise((r) => setTimeout(r, 120));
    return mockTopK(hint, topK);
  },
  ready() {
    return true;
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Native implementation (placeholder)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Stub for the production classifier. Wire this up once
 * `assets/models/insect_classifier.{mlpackage,onnx}` exist and the native
 * module is registered.
 *
 * Expected flow:
 *   1. Resize the frame to 224×224.
 *   2. Normalize with ImageNet mean/std (same as training).
 *   3. Run CoreML (iOS) or ONNX Runtime (Android).
 *   4. Map argmax → class_map.json → bugs.ts via `src/ai/classMap.ts`.
 *
 * Throws if called today — keep `mockClassifier` selected in `index.ts`
 * until the native module ships.
 */
export const nativeClassifier: VisionClassifier = {
  async classify() {
    throw new Error(
      'nativeClassifier not wired yet. Train via training/local/, export, drop into assets/models/, then implement this method.',
    );
  },
  ready() {
    return false;
  },
};
