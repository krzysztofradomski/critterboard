import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import { CAUGHT_IDS } from '@/data/bugs';
import { INITIAL_FOLLOWED } from '@/data/personProfiles';
import { DEFAULT_LANG, coerceLang, t, type LangId } from '@/i18n';
import { type PersonaId, getPersonaName } from '@/personas';
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
  /** Display names of users the current trainer follows. Persisted. */
  followed: Set<string>;
  persona: PersonaId;
  /**
   * Active UI language. Persisted across launches; set via Settings →
   * Language. Defaults to English on first run rather than reading the
   * device locale — letting the user opt in keeps i18n surprises out of
   * the onboarding flow.
   */
  language: LangId;
  profile: Profile;
  /**
   * True once the user has completed the onboarding + permissions flow.
   * Drives the cold-launch landing page via `onRehydrateStorage`.
   */
  hasOnboarded: boolean;
  toast: ToastSpec | null;
  /** URI of the most recently captured or picked photo. */
  lastPhotoUri: string | null;
};

type Actions = {
  go: <R extends RouteName>(name: R, params?: RouteParamMap[R]) => void;
  back: () => void;
  reset: (entry: StackEntry) => void;
  catchBug: (id: string) => void;
  followUser: (name: string) => void;
  unfollowUser: (name: string) => void;
  toggleFollow: (name: string) => void;
  showToast: (toast: ToastSpec) => void;
  clearToast: () => void;
  setPersona: (id: PersonaId) => void;
  setLanguage: (lang: LangId) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setLastPhotoUri: (uri: string | null) => void;
  setOnboarded: (value: boolean) => void;
};

type AppStore = State & Actions;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Storage adapter that lets us persist `dex` and `followed` (Sets) as arrays.
 *
 * We don't persist nav stack or toast — those should reset on every cold
 * launch so the user always lands on `home` (after onboarding) rather
 * than mid-flow inside, say, a half-finished SoundID session.
 */
type Persisted = Pick<
  State,
  'dex' | 'followed' | 'persona' | 'language' | 'profile' | 'hasOnboarded'
>;

type PersistedWire = {
  dex: string[];
  followed?: string[];
  persona: PersonaId;
  language?: string;
  profile: Profile;
  hasOnboarded?: boolean;
};

const wireStorage: PersistStorage<Persisted> = {
  async getItem(name) {
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    const wrapped = JSON.parse(raw) as { state: PersistedWire; version: number };
    const value: StorageValue<Persisted> = {
      state: {
        dex: new Set(wrapped.state.dex),
        followed: new Set(wrapped.state.followed ?? INITIAL_FOLLOWED),
        persona: wrapped.state.persona,
        language: coerceLang(wrapped.state.language ?? null),
        profile: wrapped.state.profile,
        hasOnboarded: Boolean(wrapped.state.hasOnboarded),
      },
      version: wrapped.version,
    };
    return value;
  },
  async setItem(name, value) {
    const wire: PersistedWire = {
      dex: Array.from(value.state.dex),
      followed: Array.from(value.state.followed),
      persona: value.state.persona,
      language: value.state.language,
      profile: value.state.profile,
      hasOnboarded: value.state.hasOnboarded,
    };
    await AsyncStorage.setItem(name, JSON.stringify({ state: wire, version: value.version ?? 0 }));
  },
  async removeItem(name) {
    await AsyncStorage.removeItem(name);
  },
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      stack: [{ name: 'onboarding', params: undefined }],
      dex: new Set(CAUGHT_IDS),
      followed: new Set(INITIAL_FOLLOWED),
      persona: 'larva',
      language: DEFAULT_LANG,
      profile: {
        name: 'you',
        networkOn: false,
        leaderboardOn: true,
        locationShareOn: false,
      },
      hasOnboarded: false,
      toast: null,
      lastPhotoUri: null,

      go: (name, params) => {
        const alias = ME_SUB_ALIAS[name];
        if (alias) {
          const next: StackEntry = { name: 'me', params: { sub: alias } };
          set({ stack: [{ name: 'home', params: undefined }, next] });
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

      followUser: (name) =>
        set((s) => {
          if (s.followed.has(name)) return s;
          const next = new Set(s.followed);
          next.add(name);
          return { followed: next };
        }),

      unfollowUser: (name) =>
        set((s) => {
          if (!s.followed.has(name)) return s;
          const next = new Set(s.followed);
          next.delete(name);
          return { followed: next };
        }),

      toggleFollow: (name) =>
        set((s) => {
          const next = new Set(s.followed);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return { followed: next };
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
        const { persona, language, showToast } = get();
        if (id === persona) return;
        const meta = getPersonaName(language, id);
        if (!meta) return;
        set({ persona: id });
        showToast({
          text: t(language, 'settings.guideToast', { name: meta.name }),
          icon: meta.emoji,
          bg: meta.avatarBg,
        });
      },

      setLanguage: (lang) => set({ language: lang }),

      setProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),

      setLastPhotoUri: (uri) => set({ lastPhotoUri: uri }),

      setOnboarded: (value) =>
        set((s) => {
          if (s.hasOnboarded === value) return s;
          return { hasOnboarded: value };
        }),
    }),
    {
      name: 'critterboard:v1',
      storage: wireStorage,
      partialize: (s): Persisted => ({
        dex: s.dex,
        followed: s.followed,
        persona: s.persona,
        language: s.language,
        profile: s.profile,
        hasOnboarded: s.hasOnboarded,
      }),
      /**
       * When persisted state hydrates, jump straight past onboarding for
       * returning users. Without this, every cold launch parks the user
       * back at the welcome screen because the nav stack is intentionally
       * NOT persisted.
       */
      onRehydrateStorage: () => (state) => {
        if (state?.hasOnboarded) {
          state.stack = [{ name: 'home', params: undefined }];
        }
      },
    },
  ),
);

/**
 * Hook returning the currently active stack entry (top of stack).
 */
export function useCurrentRoute(): StackEntry {
  return useAppStore((s) => s.stack[s.stack.length - 1] as StackEntry);
}
