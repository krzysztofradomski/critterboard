import React from 'react';

import { Screen } from '@/components/Screen';
import { Activity } from '@/screens/Activity';
import { Chat } from '@/screens/Chat';
import { Dex } from '@/screens/Dex';
import { Disambiguate } from '@/screens/Disambiguate';
import { Friends } from '@/screens/Friends';
import { Help } from '@/screens/Help';
import { Home } from '@/screens/Home';
import { Leaderboard } from '@/screens/Leaderboard';
import { MapScreen } from '@/screens/Map';
import { MeHub } from '@/screens/MeHub';
import { NoMatch } from '@/screens/NoMatch';
import { Onboarding } from '@/screens/Onboarding';
import { Permissions } from '@/screens/Permissions';
import { RegionDetail } from '@/screens/RegionDetail';
import { Result } from '@/screens/Result';
import { Scan } from '@/screens/Scan';
import { Settings } from '@/screens/Settings';
import { SoundID } from '@/screens/SoundID';
import { Streak } from '@/screens/Streak';
import type { RouteName } from '@/navigation/routes';
import { useCurrentRoute } from '@/store/useAppStore';

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
  soundid: SoundID,
  activity: Activity,
  region: RegionDetail,
  streak: Streak,
  friends: Friends,
  help: Help,
};

export function Router() {
  const top = useCurrentRoute();
  const Component = REGISTRY[top.name] ?? Home;
  return (
    <Screen keyName={`${top.name}:${JSON.stringify(top.params ?? {})}`}>
      <Component />
    </Screen>
  );
}
