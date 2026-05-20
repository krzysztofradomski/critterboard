import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import { CAUGHT_IDS } from '@/data/bugs';
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
  persona: PersonaId;
  /**
   * Active UI language. Persisted across launches; set via Settings →
   * Language. Defaults to English on first run rather than reading the
   * device locale — letting the user opt in keeps i18n surprises out of
   * the onboarding flow.
   */
  language: LangId;
  profile: Profile;
  toast: ToastSpec | null;
  /** URI of the most recently captured or picked photo. */
  lastPhotoUri: string | null;
};

type Actions = {
  go: <R extends RouteName>(name: R, params?: RouteParamMap[R]) => void;
  back: () => void;
  reset: (entry: StackEntry) => void;
  catchBug: (id: string) => void;
  showToast: (toast: ToastSpec) => void;
  clearToast: () => void;
  setPersona: (id: PersonaId) => void;
  setLanguage: (lang: LangId) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setLastPhotoUri: (uri: string | null) => void;
};

type AppStore = State & Actions;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Storage adapter that lets us persist `dex` (a Set) as an array.
 *
 * We don't persist nav stack or toast — those should reset on every cold
 * launch so the user always lands on `home` (after onboarding) rather
 * than mid-flow inside, say, a half-finished SoundID session.
 */
type Persisted = Pick<State, 'dex' | 'persona' | 'language' | 'profile'>;

type PersistedWire = {
  dex: string[];
  persona: PersonaId;
  language?: string;
  profile: Profile;
};

const wireStorage: PersistStorage<Persisted> = {
  async getItem(name) {
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    const wrapped = JSON.parse(raw) as { state: PersistedWire; version: number };
    const value: StorageValue<Persisted> = {
      state: {
        dex: new Set(wrapped.state.dex),
        persona: wrapped.state.persona,
        language: coerceLang(wrapped.state.language ?? null),
        profile: wrapped.state.profile,
      },
      version: wrapped.version,
    };
    return value;
  },
  async setItem(name, value) {
    const wire: PersistedWire = {
      dex: Array.from(value.state.dex),
      persona: value.state.persona,
      language: value.state.language,
      profile: value.state.profile,
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
      persona: 'larva',
      language: DEFAULT_LANG,
      profile: {
        name: 'you',
        networkOn: false,
        leaderboardOn: true,
        locationShareOn: false,
      },
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
    }),
    {
      name: 'critterboard:v1',
      storage: wireStorage,
      // Only persist the slices a user expects to survive an app kill.
      partialize: (s): Persisted => ({
        dex: s.dex,
        persona: s.persona,
        language: s.language,
        profile: s.profile,
      }),
    },
  ),
);

/**
 * Hook returning the currently active stack entry (top of stack).
 */
export function useCurrentRoute(): StackEntry {
  return useAppStore((s) => s.stack[s.stack.length - 1] as StackEntry);
}
