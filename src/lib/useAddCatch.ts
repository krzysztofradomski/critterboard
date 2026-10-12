import * as Location from 'expo-location';
import { useCallback } from 'react';

import { usePublishCatch } from '@/backend/hooks';
import type { Bug } from '@/data/bugs';
import { useT } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { keepPhoto } from '@/lib/photos';
import { shareForTraining } from '@/lib/shareTraining';
import type { Aim } from '@/ai/scanCrops';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

export type AddCatchOpts = {
  /** 'manual': the player named the species themselves (no XP, never uploaded). */
  source?: 'manual';
  /** Toast name for a manual catch (the localized species name). */
  name?: string;
  /** Also share the photo for training ("Help train the model" tick); needs a photo. */
  share?: { kind: 'manual' | 'confirmed'; top3?: string[]; top3p?: number[]; aim?: Aim };
};

/**
 * Add a scanned bug to the Dex: toast, back to the Dex, then (in the background) keep the photo
 * out of the cache folder, read the location if the OS allows it, store the catch and, for a
 * model catch, publish it. Shared by Result's Add to Dex and "Name it yourself".
 */
export function useAddCatch(): (bug: Bug, photoUri: string | null, opts?: AddCatchOpts) => void {
  const { go } = useNav();
  const t = useT();
  const catchBug = useAppStore((s) => s.catchBug);
  const showToast = useAppStore((s) => s.showToast);
  const locationShareOn = useAppStore((s) => s.profile.locationShareOn);
  const publishCatch = usePublishCatch();

  return useCallback(
    (bug, photoUri, opts = {}) => {
      const manual = opts.source === 'manual';
      haptics.success();
      showToast(
        manual
          ? { text: t('nameIt.addedToast', { name: opts.name ?? bug.name }), icon: bug.emoji, bg: PB.green }
          : { text: t('result.caughtToast', { xp: bug.xp, tier: bug.tier }), icon: bug.emoji, bg: PB.green },
      );
      setTimeout(() => go('dex'), 900);

      // Never block the catch on a slow GPS fix: store it once the position is in, or after
      // a short timeout. The catch is pinned on the player's own (private) map whenever the
      // OS allows location; coordinates are only published for players who share them.
      const finalize = async (coords?: { lat: number; lng: number }) => {
        const at = Date.now();
        const keptUri = photoUri ? await keepPhoto(photoUri) : null;
        catchBug(bug.id, {
          at,
          ...(keptUri ? { photoUri: keptUri } : {}),
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          ...(manual ? { source: 'manual' as const } : {}),
        });
        if (opts.share && photoUri) {
          void shareForTraining({ bugId: bug.id, latin: bug.latin, photoUri: keptUri ?? photoUri, ...opts.share });
        }
        if (!manual) {
          publishCatch(bug.id, at, locationShareOn ? coords?.lat : undefined, locationShareOn ? coords?.lng : undefined);
        }
      };

      void (async () => {
        const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (!perm?.granted) {
          void finalize();
          return;
        }
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          void finalize();
        }, 2500);
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          .then((pos) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            void finalize({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          })
          .catch(() => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            void finalize();
          });
      })();
    },
    [catchBug, go, locationShareOn, publishCatch, showToast, t],
  );
}
