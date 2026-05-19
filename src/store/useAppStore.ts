import { create } from 'zustand';

import { CAUGHT_IDS } from '@/data/bugs';
import { PERSONAS, type PersonaId } from '@/personas';
import { ME_SUB_ALIAS, type RouteName, type RouteParamMap, isMainTab } from '@/navigation/routes';

export type StackEntry<R extends RouteName = RouteName> = {
  name: R;
  params: RouteParamMap[R];
};

export type Profile = {
  name: string;
  networkOn: boolean;
  leaderboardOn: boolean;
  locationShareOn: boolean;
};

export type ToastSpec = {
  text: string;
  icon?: string;
  bg?: string;
};

type State = {
  stack: StackEntry[];
  dex: Set<string>;
  persona: PersonaId;
  profile: Profile;
  toast: ToastSpec | null;
};

type Actions = {
  go: <R extends RouteName>(name: R, params?: RouteParamMap[R]) => void;
  back: () => void;
  reset: (entry: StackEntry) => void;
  catchBug: (id: string) => void;
  showToast: (toast: ToastSpec) => void;
  clearToast: () => void;
  setPersona: (id: PersonaId) => void;
  setProfile: (patch: Partial<Profile>) => void;
};

type AppStore = State & Actions;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  stack: [{ name: 'onboarding', params: undefined }],
  dex: new Set(CAUGHT_IDS),
  persona: 'larva',
  profile: {
    name: 'you',
    networkOn: false,
    leaderboardOn: true,
    locationShareOn: false,
  },
  toast: null,

  go: (name, params) => {
    // Aliases: quests / leaderboard / settings collapse into the Me tab.
    const alias = ME_SUB_ALIAS[name];
    if (alias) {
      const next: StackEntry = {
        name: 'me',
        params: { sub: alias },
      };
      set((s) => ({ stack: [{ name: 'home', params: undefined }, next] }));
      return;
    }

    const entry = { name, params } as StackEntry;

    if (isMainTab(name)) {
      if (name === 'home') {
        set({ stack: [{ name: 'home', params: undefined }] });
      } else {
        set({ stack: [{ name: 'home', params: undefined }, entry] });
      }
      return;
    }
    set((s) => ({ stack: [...s.stack, entry] }));
  },

  back: () => {
    const { stack } = get();
    if (stack.length > 1) {
      set({ stack: stack.slice(0, -1) });
    }
  },

  reset: (entry) => set({ stack: [entry] }),

  catchBug: (id) =>
    set((s) => {
      if (s.dex.has(id)) return s;
      const next = new Set(s.dex);
      next.add(id);
      return { dex: next };
    }),

  showToast: (toast) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 2400);
  },

  clearToast: () => set({ toast: null }),

  setPersona: (id) => {
    const { persona, showToast } = get();
    if (!PERSONAS[id] || id === persona) return;
    set({ persona: id });
    const p = PERSONAS[id];
    showToast({ text: `Guide: ${p.name}`, icon: p.emoji, bg: p.avatarBg });
  },

  setProfile: (patch) =>
    set((s) => ({
      profile: { ...s.profile, ...patch },
    })),
}));

/**
 * Hook returning the currently active stack entry (top of stack).
 * Memoised by `useAppStore` selectors — re-renders only when name or
 * params change.
 */
export function useCurrentRoute(): StackEntry {
  return useAppStore((s) => s.stack[s.stack.length - 1] as StackEntry);
}
