import { useSyncExternalStore } from 'react';

import { allBugs, subscribeBugs, type Bug } from '@/data/bugs';

/**
 * All known species (bundled + installed region packs). Re-renders when a
 * pack's species are merged in, e.g. after boot-time pack hydration.
 */
export function useBugs(): readonly Bug[] {
  return useSyncExternalStore(subscribeBugs, allBugs, allBugs);
}
