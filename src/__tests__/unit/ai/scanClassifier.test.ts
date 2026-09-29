import { describe, expect, it, vi } from 'vitest';

import { selectScanClassifier } from '@/ai/scanClassifier';
import type { Candidate, VisionClassifier } from '@/ai/vision';

const fallbackCandidates: Candidate[] = [{ bugId: 'lady', confidence: 0.94 }];
const nativeCandidates: Candidate[] = [{ bugId: 'hcat', confidence: 0.91 }];

function classifier(returning: Candidate[]): VisionClassifier {
  return {
    classify: vi.fn(async () => returning),
    ready: () => true,
  };
}

describe('selectScanClassifier', () => {
  it('uses the ExecuTorch classifier when native vision is enabled and ready', async () => {
    const fallback = classifier(fallbackCandidates);
    const executorch = {
      isReady: true,
      classify: vi.fn(async () => nativeCandidates),
    };

    const classify = selectScanClassifier({
      useNativeVision: true,
      executorch,
      fallback,
    });

    await expect(classify!('photo-uri', { topK: 3 })).resolves.toEqual(nativeCandidates);
    expect(executorch.classify).toHaveBeenCalledOnce();
    expect(fallback.classify).not.toHaveBeenCalled();
  });

  it('uses the given fallback (web preview) when ExecuTorch is not ready', async () => {
    const fallback = classifier(fallbackCandidates);
    const executorch = {
      isReady: false,
      classify: vi.fn(async () => nativeCandidates),
    };

    const classify = selectScanClassifier({
      useNativeVision: true,
      executorch,
      fallback,
    });

    await expect(classify!('photo-uri', { hint: 'lady', topK: 3 })).resolves.toEqual(fallbackCandidates);
    expect(executorch.classify).not.toHaveBeenCalled();
    expect(fallback.classify).toHaveBeenCalledOnce();
  });

  it('returns null on native when the model is not ready: no made-up results', () => {
    const executorch = { isReady: false, classify: vi.fn(async () => nativeCandidates) };
    expect(selectScanClassifier({ useNativeVision: true, executorch })).toBeNull();
    expect(executorch.classify).not.toHaveBeenCalled();
  });
});
