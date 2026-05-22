/**
 * Type-safe route table for Critterboard.
 *
 * The router itself is a tiny stack maintained by Zustand (see
 * `src/store/useAppStore.ts`). This file is the single source of truth
 * for what routes exist and what each one's params look like — so a
 * stray `nav.go('scna')` or `nav.go('result', { id: undefined })` is a
 * compile-time error.
 */

export type ScanHint = string;

export type RouteParamMap = {
  onboarding: undefined;
  permissions: undefined;
  home: undefined;
  scan: { hint?: ScanHint } | undefined;
  result: { id: string; photoUri?: string };
  chat: { topic?: string } | undefined;
  dex: undefined;
  map: undefined;
  me: { sub?: MeSub } | undefined;
  quests: undefined;
  leaderboard: undefined;
  settings: undefined;
  disambiguate: { candidates?: string[]; confs?: number[] } | undefined;
  nomatch: undefined;
  soundid: undefined;
  activity: undefined;
  region: { id: string };
  streak: undefined;
  friends: undefined;
  openSourceLibraries: undefined;
  help: undefined;
};

export type RouteName = keyof RouteParamMap;
export type RouteParams<R extends RouteName> = RouteParamMap[R];

export type MeSub = 'quests' | 'leaderboard' | 'settings';

/**
 * Routes that live in the bottom tab bar. Navigating to one of these
 * resets the stack so that "back from a tab" returns to home (matches
 * the prototype's behavior).
 */
export const MAIN_TABS = ['home', 'scan', 'dex', 'map', 'me'] as const;
export type MainTab = (typeof MAIN_TABS)[number];

export function isMainTab(name: RouteName): name is MainTab {
  return (MAIN_TABS as readonly string[]).includes(name);
}

/**
 * `quests`, `leaderboard` and `settings` are not standalone routes —
 * they're sub-screens of the Me tab selected by the `sub` param.
 */
export const ME_SUB_ALIAS: Partial<Record<RouteName, MeSub>> = {
  quests: 'quests',
  leaderboard: 'leaderboard',
  settings: 'settings',
};
