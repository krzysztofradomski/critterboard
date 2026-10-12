import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { aimFractions, type Aim } from '@/ai/scanCrops';
import { enqueueContribution } from '@/backend/trainingQueue';
import { getPackData } from '@/data/regionPacks';
import { buildContribution, newContributionId } from '@/lib/contributions';
import { useAppStore } from '@/store/useAppStore';

/** Long side of a shared photo: plenty for training at 256 px crops, ~300 KB as JPEG 0.85. */
const MAX_SIDE = 1600;

/**
 * Queue a labelled photo for training (only with Network and "Help train the model" on). The
 * photo is re-encoded into a new file: smaller, and without the original's metadata (no EXIF,
 * no GPS). A failure here never affects the catch itself.
 */
export async function shareForTraining(o: {
  bugId: string;
  latin: string;
  kind: 'manual' | 'confirmed';
  photoUri: string;
  top3?: string[];
  top3p?: number[];
  aim?: Aim;
}): Promise<void> {
  const s = useAppStore.getState();
  if (!s.profile.networkOn || !s.profile.trainingShareOn) return;
  try {
    const img = await ImageManipulator.manipulate(o.photoUri).renderAsync();
    const size = { width: img.width, height: img.height };
    const k = Math.min(1, MAX_SIDE / Math.max(size.width, size.height));
    const ctx = ImageManipulator.manipulate(img);
    const out = await (k < 1 ? ctx.resize({ width: Math.round(size.width * k) }) : ctx).renderAsync();
    const saved = await out.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    img.release();
    out.release();

    const pack = s.activeRegion ? getPackData(s.activeRegion) : null;
    const meta = buildContribution({
      id: newContributionId(),
      bugId: o.bugId,
      latin: o.latin,
      kind: o.kind,
      top3: (o.top3 ?? []).map((id, i) => ({ id, p: o.top3p?.[i] ?? 0 })),
      aim: aimFractions(size, o.aim),
      creditName: s.profile.name,
      modelVersion: pack?.modelVersion ?? null,
      packVersion: pack?.version ?? null,
      at: Date.now(),
    });
    await enqueueContribution(meta, saved.uri);
  } catch {
    // Not shared; the catch is unaffected.
  }
}
