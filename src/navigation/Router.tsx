import React, { memo, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Activity } from '@/screens/Activity';
import { Chat } from '@/screens/Chat';
import { Dex } from '@/screens/Dex';
import { Disambiguate } from '@/screens/Disambiguate';
import { Help } from '@/screens/Help';
import { Home } from '@/screens/Home';
import { Leaderboard } from '@/screens/Leaderboard';
import { MapScreen } from '@/screens/Map';
import { MeHub } from '@/screens/MeHub';
import { NoMatch } from '@/screens/NoMatch';
import { Onboarding } from '@/screens/Onboarding';
import { OpenSourceLibraries } from '@/screens/OpenSourceLibraries';
import { Permissions } from '@/screens/Permissions';
import { RegionDetail } from '@/screens/RegionDetail';
import { Result } from '@/screens/Result';
import { Scan } from '@/screens/Scan';
import { Settings } from '@/screens/Settings';
import { Streak } from '@/screens/Streak';
import type { RouteName } from '@/navigation/routes';
import { RouteContext, useAppStore, type StackEntry } from '@/store/useAppStore';

const REGISTRY: Record<RouteName, React.ComponentType> = {
  onboarding: Onboarding,
  permissions: Permissions,
  home: Home,
  scan: Scan,
  result: Result,
  chat: Chat,
  dex: Dex,
  map: MapScreen,
  me: MeHub,
  quests: MeHub,
  leaderboard: MeHub,
  settings: Settings,
  disambiguate: Disambiguate,
  nomatch: NoMatch,
  activity: Activity,
  region: RegionDetail,
  streak: Streak,
  openSourceLibraries: OpenSourceLibraries,
  help: Help,
};

/**
 * Main tabs that stay mounted (hidden) after their first visit, so coming back is instant and
 * keeps scroll position and search. Scan (camera) and Map (GL surface) still mount per visit:
 * a hidden native surface isn't reliably hidden or cheap, and their slow parts are cached.
 */
const KEEP_MOUNTED: ReadonlySet<RouteName> = new Set(['home', 'dex', 'me']);

/** Same name + params = same screen; new params remount it (screens seed state from params). */
function entryKey(entry: StackEntry): string {
  return `${entry.name}:${JSON.stringify(entry.params ?? {})}`;
}

const RouteScreen = memo(function RouteScreen({ entry, active }: { entry: StackEntry; active: boolean }) {
  const Component = REGISTRY[entry.name] ?? Home;
  return (
    <RouteContext.Provider value={entry}>
      {/* A new keyName replays the fade-in, also when a kept tab comes back. */}
      <Screen keyName={active ? entryKey(entry) : 'hidden'}>
        <Component />
      </Screen>
    </RouteContext.Provider>
  );
});

export const Router = memo(function Router() {
  const hydrated = useAppStore((s) => s.hydrated);
  const top = useAppStore((s) => s.stack[s.stack.length - 1] as StackEntry);
  const [kept, setKept] = useState<StackEntry[]>([]);

  // Remember the latest entry of each visited kept tab (state updated during render, the
  // documented pattern for derived state: React re-renders before committing).
  let keptNow = kept;
  if (top.name === 'onboarding' && kept.length > 0) {
    keptNow = []; // wipe / fresh start: nothing from the old session stays mounted
  } else if (KEEP_MOUNTED.has(top.name) && !kept.includes(top)) {
    keptNow = [...kept.filter((e) => e.name !== top.name), top];
  }
  if (keptNow !== kept) setKept(keptNow);

  // A hidden screen keeps its focused input, and with it the keyboard.
  useEffect(() => Keyboard.dismiss(), [top.name]);

  if (!hydrated) return null;

  return (
    <>
      {keptNow.map((entry) => {
        const visible = entry === top;
        return (
          <View
            key={entryKey(entry)}
            style={[StyleSheet.absoluteFill, !visible && styles.hidden]}
            pointerEvents={visible ? 'box-none' : 'none'}
            accessibilityElementsHidden={!visible}
            importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
          >
            <RouteScreen entry={entry} active={visible} />
          </View>
        );
      })}
      {/* Unkeyed, as before: a new route of the same type (e.g. another Result) re-renders in place. */}
      {!KEEP_MOUNTED.has(top.name) && <RouteScreen entry={top} active />}
    </>
  );
});

const styles = StyleSheet.create({
  // Opacity, not display:none: the screen keeps its layout, so lists keep their scroll offset.
  hidden: { opacity: 0 },
});
