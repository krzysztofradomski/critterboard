import React, { useSyncExternalStore } from 'react';
import { Image, Text } from 'react-native';

import { allBugIcons, subscribeBugIcons } from '@/data/bugIcons';
import type { Bug } from '@/data/bugs';
import { PB } from '@/tokens/pb';

export type BugIconProps = {
  bug: Pick<Bug, 'id' | 'emoji'>;
  /** Box size in px. The emoji fallback is drawn a bit smaller to match. */
  size: number;
  /** Uncaught species: an ink silhouette of the sticker (or a faded emoji). */
  silhouette?: boolean;
};

/** Re-renders when pack icons are registered or removed. */
export function useBugIconUri(id: string): string | undefined {
  return useSyncExternalStore(subscribeBugIcons, allBugIcons, allBugIcons).get(id);
}

/** A species' photo-based sticker icon, or its emoji when there is none. */
export function BugIcon({ bug, size, silhouette = false }: BugIconProps) {
  const uri = useBugIconUri(bug.id);
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={[
          { width: size, height: size },
          silhouette && { tintColor: PB.ink, opacity: 0.4 },
        ]}
      />
    );
  }
  return (
    <Text style={[{ fontSize: Math.round(size * 0.72) }, silhouette && { opacity: 0.3 }]}>
      {bug.emoji}
    </Text>
  );
}
