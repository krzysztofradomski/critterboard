import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import { CAUGHT_IDS } from '@/data/bugs';
import { INITIAL_FOLLOWED } from '@/data/personProfiles';
import { QUESTS, QUEST_RULES } from '@/data/quests';
import { DEFAULT_LANG, coerceLang, t, type LangId } from '@/i18n';
import { type PersonaId, getPersonaName } from '@/personas';
import { ME_SUB_ALIAS, type RouteName, type RouteParamMap, isMainTab } from '@/navigation/routes';
import { buildSeedCatchLog, currentStreak, type CatchEvent } from '@/lib/streak';
import { questsAdvancedBy } from '@/lib/quests';

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

/**
 * Cached reverse-geocode result for the Map header. The lat/lng are
 * kept alongside the resolved labels so a stale cache can be detected
 * without re-fetching geocode info (e.g. if the user moves cities, the
 * 24h TTL expires before the labels go visibly wrong).
 */
export type MapLocationCache = {
  lat: number;
  lng: number;
  city: string;
  region: string;
  at: number;
};

/**
 * Activity-feed entries. Three kinds for now (catch / persona /
 * streak); each carries the minimum data the Activity screen needs to
 * render a localized title + subtitle + CTA route. Production-shape:
 * if a real backend ever lands, system-side events (model updates,
 * pack syncs) join this same list.
 */
export type ActivityEntry =
  | { id: string; kind: 'catch';   at: number; bugId: string; photoUri?: string }
  | { id: string; kind: 'persona'; at: number; personaId: PersonaId }
  | { id: string; kind: 'streak';  at: number; days: number };

const ACTIVITY_CAP = 50;
const STREAK_MILESTONES: ReadonlySet<number> = new Set([3, 7, 14, 30]);

/**
 * Options bag for a `catchBug` call. Both photo URI and coordinates
 * are optional and independent: a user with locationShareOn but a
 * camera failure stamps coords-only, and vice versa.
 */
export type CatchBugOptions = {
  photoUri?: string;
  lat?: number;
  lng?: number;
};

type State = {
  stack: StackEntry[];
  dex: Set<string>;
  /** Display names of users the current trainer follows. Persisted. */
  followed: Set<string>;
  persona: PersonaId;
  /** Active UI language. Persisted across launches. */
  language: LangId;
  profile: Profile;
  /** True once the user has completed onboarding + permissions. */
  hasOnboarded: boolean;
  toast: ToastSpec | null;
  /** URI of the most recently captured or picked photo. */
  lastPhotoUri: string | null;

  /** Append-only catch event log. Drives streak math and recent-catches UI. */
  catchLog: CatchEvent[];
  /** Newest-first activity feed, capped at ACTIVITY_CAP entries. */
  activityLog: ActivityEntry[];
  /**
   * Reverse-geocoded location for the Map header, refreshed at most
   * every 24h. Null when `profile.locationShareOn` is off or before the
   * first successful fetch.
   */
  mapLocation: MapLocationCache | null;

  /** Live quest counters, keyed by quest id. Resolved against templates by `useQuests`. */
  questProgress: Record<string, number>;
  /**
   * Epoch ms at which each quest first reached 100%. Sticky — once
   * stamped, the entry stays even if the rolling counter dips below the
   * target (a daily quest that hits goal then rolls over still shows in
   * the completed drawer). Empty on first run; the drawer falls back to
   * the seeded `COMPLETED_QUESTS` so the screen isn't empty.
   */
  questCompletedAt: Record<string, number>;
};

type Actions = {
  go: <R extends RouteName>(name: R, params?: RouteParamMap[R]) => void;
  back: () => void;
  reset: (entry: StackEntry) => void;
  catchBug: (id: string, opts?: CatchBugOptions) => void;
  followUser: (name: string) => void;
  unfollowUser: (name: string) => void;
  toggleFollow: (name: string) => void;
  showToast: (toast: ToastSpec) => void;
  clearToast: () => void;
  setPersona: (id: PersonaId) => void;
  setLanguage: (lang: LangId) => void;
  setProfile: (patch: Partial<Profile>) => void;
  setLastPhotoUri: (uri: string | null) => void;
  setMapLocation: (loc: MapLocationCache | null) => void;
  setOnboarded: (value: boolean) => void;
  /**
   * Reset every user-visible slice to its first-run state and drop the
   * AsyncStorage record. Language is preserved — it's an explicit
   * preference, not user data, and wiping it would surprise non-English
   * speakers. Routes back to onboarding so the next interaction is
   * indistinguishable from a fresh install.
   */
  wipeAll: () => Promise<void>;
  /**
   * Delete every cached scan photo from disk and strip the URIs from
   * both `catchLog` and `activityLog` entries. Returns counts so the UI
   * can show a truthful toast (deleted N photos · M MB).
   */
  clearScanCache: () => Promise<{ deleted: number; bytes: number }>;
};

type AppStore = State & Actions;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initial quest progress: seed from the static template so the screen
 * shows the same numbers it always did on first launch. Once the user
 * catches a matching bug the store-side value supersedes the template.
 */
function initialQuestProgress(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of QUESTS) out[q.id] = q.progress;
  return out;
}

/**
 * Synthesize an initial activity feed from the seed catch log so the
 * Activity screen isn't a sea of crickets the first time the user
 * opens it. Only the 10 most recent catches are turned into entries —
 * older catches still drive streak math, they just don't show up in
 * the feed.
 */
function initialActivityLog(catchLog: CatchEvent[]): ActivityEntry[] {
  const sorted = [...catchLog].sort((a, b) => b.at - a.at).slice(0, 10);
  return sorted.map((e, i) => ({
    id: `seed-${i}`,
    kind: 'catch' as const,
    at: e.at,
    bugId: e.id,
  }));
}

/**
 * Generate a stable-ish id for activity entries. `at` + a tiny counter
 * is plenty — we never reconcile across devices.
 */
let activityCounter = 0;
function newActivityId(at: number): string {
  activityCounter = (activityCounter + 1) % 1_000_000;
  return `${at}-${activityCounter}`;
}

function prependActivity(log: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  const next = [entry, ...log];
  return next.length > ACTIVITY_CAP ? next.slice(0, ACTIVITY_CAP) : next;
}

// ──────────────────────────────────────────────────────────────────────────
// Persistence wire format
// ──────────────────────────────────────────────────────────────────────────

type Persisted = Pick<
  State,
  | 'dex'
  | 'followed'
  | 'persona'
  | 'language'
  | 'profile'
  | 'hasOnboarded'
  | 'catchLog'
  | 'activityLog'
  | 'mapLocation'
  | 'questProgress'
  | 'questCompletedAt'
>;

type PersistedWire = {
  dex: string[];
  followed?: string[];
  persona: PersonaId;
  language?: string;
  profile: Profile;
  hasOnboarded?: boolean;
  catchLog?: CatchEvent[];
  activityLog?: ActivityEntry[];
  mapLocation?: MapLocationCache | null;
  questProgress?: Record<string, number>;
  questCompletedAt?: Record<string, number>;
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
        catchLog: wrapped.state.catchLog ?? buildSeedCatchLog(),
        activityLog: wrapped.state.activityLog ?? [],
        mapLocation: wrapped.state.mapLocation ?? null,
        questProgress: { ...initialQuestProgress(), ...(wrapped.state.questProgress ?? {}) },
        questCompletedAt: wrapped.state.questCompletedAt ?? {},
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
      catchLog: value.state.catchLog,
      activityLog: value.state.activityLog,
      mapLocation: value.state.mapLocation,
      questProgress: value.state.questProgress,
      questCompletedAt: value.state.questCompletedAt,
    };
    await AsyncStorage.setItem(name, JSON.stringify({ state: wire, version: value.version ?? 0 }));
  },
  async removeItem(name) {
    await AsyncStorage.removeItem(name);
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────

const SEED_CATCH_LOG = buildSeedCatchLog();

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

      catchLog: SEED_CATCH_LOG,
      activityLog: initialActivityLog(SEED_CATCH_LOG),
      mapLocation: null,
      questProgress: initialQuestProgress(),
      questCompletedAt: {},

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

      /**
       * The hot path. A single catch ripples through four pieces of
       * state at once: dex (uniqueness set), catchLog (timestamps for
       * streak math), questProgress (counters for matching quests),
       * activityLog (catch event + optional streak-milestone event).
       *
       * Everything is computed before the `set` so the update is a
       * single atomic mutation.
       */
      catchBug: (id, opts) =>
        set((s) => {
          const at = Date.now();
          const photoUri = opts?.photoUri;
          const event: CatchEvent = { id, at };
          if (photoUri) event.photoUri = photoUri;
          if (opts?.lat !== undefined && opts?.lng !== undefined) {
            event.lat = opts.lat;
            event.lng = opts.lng;
          }

          const nextDex = s.dex.has(id) ? s.dex : new Set(s.dex).add(id);
          const nextCatchLog = [...s.catchLog, event];

          // Quest counters: only bump those advanced by this catch.
          const advanced = questsAdvancedBy(id, s.questProgress);
          let nextProgress = s.questProgress;
          if (advanced.length > 0) {
            nextProgress = { ...s.questProgress };
            for (const qid of advanced) {
              nextProgress[qid] = (nextProgress[qid] ?? 0) + 1;
            }
          }

          // Activity log: every catch yields one entry. If today's first
          // catch crosses a streak milestone, log a second.
          const catchEntry: ActivityEntry = {
            id: newActivityId(at),
            kind: 'catch',
            at,
            bugId: id,
            ...(photoUri ? { photoUri } : {}),
          };
          let nextActivity = prependActivity(s.activityLog, catchEntry);

          const before = currentStreak(s.catchLog, at);
          const after = currentStreak(nextCatchLog, at);
          if (after > before && STREAK_MILESTONES.has(after)) {
            nextActivity = prependActivity(nextActivity, {
              id: newActivityId(at + 1),
              kind: 'streak',
              at: at + 1,
              days: after,
            });
          }

          // Stamp first-completion timestamps. Trait/rarity quests stamp
          // when their counter crosses `total`; the q4 streak quest
          // stamps when the post-catch streak reaches its target. Sticky
          // — never clear once set, even if the counter rolls.
          let nextCompleted = s.questCompletedAt;
          let touchedCompleted = false;
          for (const q of QUESTS) {
            if (nextCompleted[q.id] !== undefined) continue;
            const rule = QUEST_RULES[q.id];
            const progress = rule?.kind === 'streak' ? after : (nextProgress[q.id] ?? 0);
            if (progress >= q.total) {
              if (!touchedCompleted) {
                nextCompleted = { ...nextCompleted };
                touchedCompleted = true;
              }
              nextCompleted[q.id] = at;
            }
          }

          return {
            dex: nextDex,
            catchLog: nextCatchLog,
            questProgress: nextProgress,
            activityLog: nextActivity,
            ...(touchedCompleted ? { questCompletedAt: nextCompleted } : {}),
          };
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
        const { persona, language, showToast, activityLog } = get();
        if (id === persona) return;
        const meta = getPersonaName(language, id);
        if (!meta) return;
        const at = Date.now();
        set({
          persona: id,
          activityLog: prependActivity(activityLog, {
            id: newActivityId(at),
            kind: 'persona',
            at,
            personaId: id,
          }),
        });
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

      setMapLocation: (loc) => set({ mapLocation: loc }),

      setOnboarded: (value) =>
        set((s) => {
          if (s.hasOnboarded === value) return s;
          return { hasOnboarded: value };
        }),

      clearScanCache: async () => {
        const events = get().catchLog;
        const uris = new Set<string>();
        for (const e of events) if (e.photoUri) uris.add(e.photoUri);

        let deleted = 0;
        let bytes = 0;
        for (const uri of uris) {
          try {
            const info = await FileSystem.getInfoAsync(uri, { size: true });
            if (info.exists && typeof info.size === 'number') bytes += info.size;
            await FileSystem.deleteAsync(uri, { idempotent: true });
            deleted += 1;
          } catch {
            // Already gone (e.g. cache evicted by OS) or unreachable — skip
            // silently. The store-side strip below still drops the URI so
            // we don't promise the user a photo that isn't there.
          }
        }

        set((s) => ({
          catchLog: s.catchLog.map((e) =>
            e.photoUri ? { id: e.id, at: e.at } : e,
          ),
          activityLog: s.activityLog.map((e) =>
            e.kind === 'catch' && e.photoUri
              ? { id: e.id, kind: 'catch', at: e.at, bugId: e.bugId }
              : e,
          ),
        }));

        return { deleted, bytes };
      },

      wipeAll: async () => {
        const keepLanguage = get().language;
        if (toastTimer) {
          clearTimeout(toastTimer);
          toastTimer = null;
        }
        await AsyncStorage.removeItem('critterboard:v1');
        // Reset every persisted slice. Note: dex/catchLog go to EMPTY,
        // not back to the seeded values — "wipe" means lose the
        // history, not regenerate yesterday's fake catches.
        set({
          stack: [{ name: 'onboarding', params: undefined }],
          dex: new Set(),
          followed: new Set(INITIAL_FOLLOWED),
          persona: 'larva',
          language: keepLanguage,
          profile: {
            name: 'you',
            networkOn: false,
            leaderboardOn: true,
            locationShareOn: false,
          },
          hasOnboarded: false,
          toast: null,
          lastPhotoUri: null,
          catchLog: [],
          activityLog: [],
          mapLocation: null,
          questProgress: initialQuestProgress(),
          questCompletedAt: {},
        });
      },
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
        catchLog: s.catchLog,
        activityLog: s.activityLog,
        mapLocation: s.mapLocation,
        questProgress: s.questProgress,
        questCompletedAt: s.questCompletedAt,
      }),
      /**
       * Skip past onboarding for returning users. The flag is set in
       * Permissions.finish() — without this hook every cold launch
       * would park them back at the welcome screen because the nav
       * stack is intentionally NOT persisted.
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
