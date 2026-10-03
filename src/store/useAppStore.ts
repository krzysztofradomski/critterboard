import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext } from 'react';
import { getRandomBytes, randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

import { INITIAL_FOLLOWED } from '@/data/personProfiles';
import { QUESTS, QUEST_RULES } from '@/data/quests';
import { DEFAULT_LANG, coerceLang, t, type LangId } from '@/i18n';
import { type PersonaId, getPersonaName } from '@/personas';
import { ME_SUB_ALIAS, type RouteName, type RouteParamMap, isMainTab } from '@/navigation/routes';
import { getPackData } from '@/data/regionPacks';
import { currentStreak, type CatchEvent } from '@/lib/streak';
import {
  buildConversationMemoryEntry,
  type ConversationMemoryEntry,
} from '@/lib/conversationMemory';
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
  /**
   * Opt-in crash reporting. Off on first run. When `networkOn` flips
   * off the Settings screen drops this back to `false` too — crash
   * reports can't leave a fully-offline device.
   */
  crashReportingOn: boolean;
  /**
   * Lowest model confidence (percent) a scan result may have and still be
   * offered for the Dex. Adjustable in Brains.
   */
  minConfidence: number;
  /** Vibration feedback on toggles, tabs and key actions. */
  hapticsOn: boolean;
};

export const DEFAULT_MIN_CONFIDENCE = 33;

/**
 * What this device has put on the server. Nothing leaves the phone until Network is on; this
 * tracks what did, so the app can show sync progress and delete it all again.
 */
export type OnlineState = {
  /** When Network was first switched on (ms); catches from before it need an explicit upload. */
  since: number | null;
  /** True once a profile or catch reached the server and not yet deleted. */
  hasData: boolean;
  /** The user agreed to upload catches made before `since`. */
  backfill: boolean;
  /** `bugId:at` of every catch known to be on the server. */
  uploaded: string[];
  /** A "hide my profile" the user asked for that hasn't reached the server yet (retried at launch). */
  hideOwed: boolean;
  /** A "remove stored locations" the user asked for that hasn't reached the server yet (retried at launch). */
  clearLocationsOwed: boolean;
};

export const EMPTY_ONLINE: OnlineState = {
  since: null,
  hasData: false,
  backfill: false,
  uploaded: [],
  hideOwed: false,
  clearLocationsOwed: false,
};

export type SyncStatus = {
  phase: 'idle' | 'syncing' | 'error';
  done: number;
  total: number;
};

/**
 * Generate a device-local pseudonymous user id. The backend treats
 * this as the caller's identity; there is no email / phone / OAuth
 * handshake. Reset by `wipeAll` so a fresh install is genuinely
 * indistinguishable from a new user.
 *
 * Generates a RFC-4122 v4 UUID with expo-crypto (native secure RNG; Hermes
 * has no global `crypto`). Required to be cryptographically random because
 * the ID acts as a bearer token.
 */
function newBackendUserId(): string {
  return randomUUID();
}

/**
 * Secret that proves this device owns `backendUserId`. The id is public (it appears in
 * leaderboards); this never leaves the phone except in the login request, where the
 * server stores only its hash. 32 random bytes, hex.
 */
function newBackendSecret(): string {
  return Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A fresh online identity, for `setState` after the old one was deleted on the server. */
export function newBackendIdentity(): { backendUserId: string; backendSecret: string } {
  return { backendUserId: newBackendUserId(), backendSecret: newBackendSecret() };
}

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

const ACTIVITY_CAP = 30;
const ACTIVITY_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const MEMORY_CAP = 1200;
const STREAK_MILESTONES: ReadonlySet<number> = new Set([3, 7, 14, 30]);

/**
 * Options bag for a `catchBug` call. Both photo URI and coordinates
 * are optional and independent: a user with locationShareOn but a
 * camera failure stamps coords-only, and vice versa.
 */
export type CatchBugOptions = {
  /** Capture time; pass the one you also publish so the local and online copies share a key. */
  at?: number;
  photoUri?: string;
  lat?: number;
  lng?: number;
};

export type ChatMessage = {
  who: 'me' | 'larva';
  t: string;
};

export type ChatThread = {
  messages: ChatMessage[];
  updatedAt: number;
  /**
   * AI-generated summary of older turns (produced once history crosses
   * SUMMARY_THRESHOLD). Injected into the system prompt so recent turns
   * can drop to a shorter window without losing continuity. Cleared on
   * any message deletion so it's never stale.
   */
  summary?: string;
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
   * every 15 minutes. Null before the first successful fix or when the OS
   * location permission isn't granted.
   */
  mapLocation: MapLocationCache | null;

  /** Live quest counters, keyed by quest id. Resolved against templates by `useQuests`. */
  questProgress: Record<string, number>;
  /**
   * Epoch ms at which each quest first reached 100%. Sticky — once
   * stamped, the entry stays even if the rolling counter dips below the
   * target (a daily quest that hits goal then rolls over still shows in
   * the completed drawer). Empty on first run.
   */
  questCompletedAt: Record<string, number>;
  /**
   * Epoch ms at which each quest reward was claimed. Distinct from
   * `questCompletedAt`: a quest hits 100% automatically, but the XP
   * reward is only granted once the user taps Claim. Once claimed, the
   * quest can't be re-claimed (the entry is sticky for the lifetime of
   * the wipe).
   */
  questClaimedAt: Record<string, number>;
  /**
   * Device-local pseudonymous identity used by the backend adapter
   * (see `src/backend/`). Lazily generated on first run, persisted,
   * and rotated by `wipeAll`. Never sent to a server until the user
   * flips `profile.networkOn` on — the value is *eligible* to be sent,
   * not *committed* to be sent. There is no account.
   */
  backendUserId: string;
  /** Proof of ownership of `backendUserId` (see `newBackendSecret`); rotated with it on wipe. */
  backendSecret: string;
  online: OnlineState;
  /** Live upload progress (not persisted). */
  syncStatus: SyncStatus;
  /**
   * True once the saved state has been read (or failed to read) at launch. Not persisted.
   * The Router renders nothing before, so returning users never see onboarding flash by.
   */
  hydrated: boolean;
  /** Persisted chat transcripts keyed by `persona::topic`. */
  chatThreads: Record<string, ChatThread>;
  /** Searchable conversation index for cross-thread memory retrieval. */
  conversationMemory: ConversationMemoryEntry[];
  /** Region IDs for which the pack JSON + model .pte have been downloaded. */
  installedRegions: string[];
  /**
   * The one region whose model Scan uses (null when none is installed).
   * Installing a region activates it; the user can switch among installed
   * regions in Brains.
   */
  activeRegion: string | null;
  /**
   * Label map of the active region pack (scientific name →
   * class index). Persisted so Scan can load the model without waiting
   * for hydrateInstalledPacks() to replay AsyncStorage on each boot.
   */
  activeLabelMap: Record<string, number>;
  /**
   * Installed pack version per region ID, mirroring packs/manifest.json.
   * Used at boot to detect when a newer pack/model has shipped and trigger
   * a refresh (see syncInstalledPacks).
   */
  installedPackVersions: Record<string, number>;
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
  setOnline: (patch: Partial<OnlineState>) => void;
  markUploaded: (keys: string[]) => void;
  setSyncStatus: (status: SyncStatus) => void;
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
  /**
   * Claim a completed quest's reward. Returns the reward amount on
   * success, or null if the quest doesn't exist, isn't complete, or has
   * already been claimed. Caller uses the returned value to drive the
   * toast / haptic.
   */
  claimQuest: (id: string) => { reward: number } | null;
  saveChatThread: (threadId: string, messages: ChatMessage[]) => void;
  indexConversationMessage: (threadId: string, message: ChatMessage) => void;
  clearChatThread: (threadId: string) => void;
  clearConversationData: () => void;
  /** Store an AI-generated summary for a thread's older context. */
  updateThreadSummary: (threadId: string, summary: string) => void;
  /**
   * Remove a single message by index from a thread and strip its memory
   * entry. Also clears the thread summary since it may now be stale.
   */
  removeMessageFromThread: (threadId: string, index: number) => void;
  installRegion: (id: string, labelMap: Record<string, number>, version: number) => void;
  uninstallRegion: (id: string) => void;
  /** Make an installed region the active one (its model + label map drive Scan). */
  setActiveRegion: (id: string) => void;
  /**
   * Strip the GPS coordinates from a catch event so it no longer appears
   * as a pin on the map. The catch itself stays in the log and dex.
   * Identified by the event's `at` timestamp (unique per session).
   */
  removeMapPin: (catchAt: number) => void;
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
 * Generate a stable-ish id for activity entries. `at` + a tiny counter
 * is plenty — we never reconcile across devices.
 */
let activityCounter = 0;
function newActivityId(at: number): string {
  activityCounter = (activityCounter + 1) % 1_000_000;
  return `${at}-${activityCounter}`;
}

/**
 * Keep the Buzz feed short: newest first, nothing older than 30 days, at most ACTIVITY_CAP entries,
 * and only the latest "switched guide" (that is a state, not a history worth listing).
 */
export function pruneActivity(log: ActivityEntry[], now = Date.now()): ActivityEntry[] {
  let seenPersona = false;
  const kept = log.filter((e) => {
    if (now - e.at > ACTIVITY_MAX_AGE_MS) return false;
    if (e.kind === 'persona') {
      if (seenPersona) return false;
      seenPersona = true;
    }
    return true;
  });
  return kept.length > ACTIVITY_CAP ? kept.slice(0, ACTIVITY_CAP) : kept;
}

function prependActivity(log: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  return pruneActivity([entry, ...log]);
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
  | 'questClaimedAt'
  | 'backendUserId'
  | 'backendSecret'
  | 'online'
  | 'chatThreads'
  | 'conversationMemory'
  | 'installedRegions'
  | 'activeRegion'
  | 'activeLabelMap'
  | 'installedPackVersions'
>;

type PersistedWire = {
  dex: string[];
  followed?: string[];
  persona: PersonaId;
  language?: string;
  // `crashReportingOn` was added after the first ship, so legacy blobs
  // won't have it. `localLlmOn` existed until chat became Gemma-only (the
  // model file on disk now decides); older blobs may still carry it.
  profile: Omit<Profile, 'crashReportingOn' | 'minConfidence' | 'hapticsOn'> & {
    crashReportingOn?: boolean;
    minConfidence?: number;
    hapticsOn?: boolean;
    localLlmOn?: boolean;
  };
  hasOnboarded?: boolean;
  catchLog?: CatchEvent[];
  activityLog?: ActivityEntry[];
  mapLocation?: MapLocationCache | null;
  questProgress?: Record<string, number>;
  questCompletedAt?: Record<string, number>;
  questClaimedAt?: Record<string, number>;
  /** Backfilled to a fresh id for users persisted before the slice existed. */
  backendUserId?: string;
  /** Backfilled for users persisted before login required a secret. */
  backendSecret?: string;
  online?: OnlineState;
  chatThreads?: Record<string, ChatThread>;
  conversationMemory?: ConversationMemoryEntry[];
  installedRegions?: string[];
  activeRegion?: string | null;
  activeLabelMap?: Record<string, number>;
  installedPackVersions?: Record<string, number>;
};

/**
 * Coalesce bursts of writes: the first `schedule` opens a `delayMs` window, later calls inside it
 * only replace the value, and the window's end writes the latest one. Writes run one at a time,
 * in order, so a slow write can never land after a newer one.
 */
export function createCoalescedWriter<T>(write: (value: T) => Promise<void>, delayMs: number) {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending) {
      const { value } = pending;
      pending = null;
      chain = chain
        .then(() => write(value))
        .catch((e) => {
          if (__DEV__) console.warn('[persist] write failed', e);
        });
    }
    return chain;
  };
  return {
    schedule(value: T) {
      pending = { value };
      timer ??= setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

async function writeWire(name: string, value: StorageValue<Persisted>): Promise<void> {
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
    questClaimedAt: value.state.questClaimedAt,
    backendUserId: value.state.backendUserId,
    backendSecret: value.state.backendSecret,
    online: value.state.online,
    chatThreads: value.state.chatThreads,
    conversationMemory: value.state.conversationMemory,
    installedRegions: value.state.installedRegions,
    activeRegion: value.state.activeRegion,
    activeLabelMap: value.state.activeLabelMap,
    installedPackVersions: value.state.installedPackVersions,
  };
  await AsyncStorage.setItem(name, JSON.stringify({ state: wire, version: value.version ?? 0 }));
}

/**
 * zustand's persist writes after *every* `set` (each nav tap, toast, chat token), and the blob
 * holds every chat thread and the memory index (~0.5 MB for an active user). Writing at most
 * every 500 ms keeps that off the JS thread; App flushes it when the app leaves the foreground.
 */
const PERSIST_WINDOW_MS = 500;
const persistWriter = createCoalescedWriter(
  ({ name, value }: { name: string; value: StorageValue<Persisted> }) => writeWire(name, value),
  PERSIST_WINDOW_MS,
);

/** Write any pending store change now (call when the app goes to the background). */
export function flushPersistedState(): Promise<void> {
  return persistWriter.flush();
}

/**
 * Hydration replaces state with a raw `set` (no write), so a write scheduled before it finished
 * (e.g. the launch-time language seed) would save first-run defaults over the user's data.
 */
let rehydrated = false;

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
        // Backfill `crashReportingOn` for users persisted before the
        // flag existed. Defaulting to false keeps the opt-in invariant
        // intact — upgrading the app should never start sending crash
        // reports without an explicit user action.
        profile: (({ localLlmOn: _retired, ...p }) => ({ crashReportingOn: false, minConfidence: DEFAULT_MIN_CONFIDENCE, hapticsOn: true, ...p }))(
          wrapped.state.profile,
        ),
        hasOnboarded: Boolean(wrapped.state.hasOnboarded),
        catchLog: wrapped.state.catchLog ?? [],
        activityLog: pruneActivity(wrapped.state.activityLog ?? []),
        mapLocation: wrapped.state.mapLocation ?? null,
        questProgress: { ...initialQuestProgress(), ...(wrapped.state.questProgress ?? {}) },
        questCompletedAt: wrapped.state.questCompletedAt ?? {},
        questClaimedAt: wrapped.state.questClaimedAt ?? {},
        backendUserId: wrapped.state.backendUserId ?? newBackendUserId(),
        backendSecret: wrapped.state.backendSecret ?? newBackendSecret(),
        online: { ...EMPTY_ONLINE, ...(wrapped.state.online ?? {}) },
        chatThreads: wrapped.state.chatThreads ?? {},
        conversationMemory: wrapped.state.conversationMemory ?? [],
        installedRegions: wrapped.state.installedRegions ?? [],
        // Older saves had no explicit choice: the first installed region was active.
        activeRegion:
          wrapped.state.activeRegion ?? wrapped.state.installedRegions?.[0] ?? null,
        activeLabelMap: wrapped.state.activeLabelMap ?? {},
        installedPackVersions: wrapped.state.installedPackVersions ?? {},
      },
      version: wrapped.version,
    };
    return value;
  },
  setItem(name, value) {
    if (!rehydrated) return;
    persistWriter.schedule({ name, value });
  },
  async removeItem(name) {
    persistWriter.cancel();
    await AsyncStorage.removeItem(name);
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      stack: [{ name: 'onboarding', params: undefined }],
      dex: new Set(),
      followed: new Set(INITIAL_FOLLOWED),
      persona: 'larva',
      language: DEFAULT_LANG,
      profile: {
        name: 'you',
        networkOn: false,
        leaderboardOn: true,
        locationShareOn: false,
        crashReportingOn: false,
        minConfidence: DEFAULT_MIN_CONFIDENCE,
        hapticsOn: true,
      },
      hasOnboarded: false,
      toast: null,
      lastPhotoUri: null,

      catchLog: [],
      activityLog: [],
      mapLocation: null,
      questProgress: initialQuestProgress(),
      questCompletedAt: {},
      questClaimedAt: {},
      backendUserId: newBackendUserId(),
      backendSecret: newBackendSecret(),
      online: EMPTY_ONLINE,
      syncStatus: { phase: 'idle', done: 0, total: 0 },
      hydrated: false,
      chatThreads: {},
      conversationMemory: [],
      installedRegions: [],
      activeRegion: null,
      activeLabelMap: {},
      installedPackVersions: {},

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
          const at = opts?.at ?? Date.now();
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

      setOnline: (patch) => set((s) => ({ online: { ...s.online, ...patch } })),

      markUploaded: (keys) =>
        set((s) => ({
          online: { ...s.online, hasData: true, uploaded: Array.from(new Set([...s.online.uploaded, ...keys])) },
        })),

      setSyncStatus: (status) => set({ syncStatus: status }),

      setLastPhotoUri: (uri) => set({ lastPhotoUri: uri }),

      setMapLocation: (loc) => set({ mapLocation: loc }),

      setOnboarded: (value) =>
        set((s) => {
          if (s.hasOnboarded === value) return s;
          return { hasOnboarded: value };
        }),

      claimQuest: (id) => {
        const s = get();
        const quest = QUESTS.find((q) => q.id === id);
        if (!quest) return null;
        if (s.questClaimedAt[id] !== undefined) return null;
        if (s.questCompletedAt[id] === undefined) return null;
        const at = Date.now();
        set({ questClaimedAt: { ...s.questClaimedAt, [id]: at } });
        return { reward: quest.reward };
      },

      saveChatThread: (threadId, messages) =>
        set((s) => ({
          chatThreads: {
            ...s.chatThreads,
            [threadId]: {
              messages,
              updatedAt: Date.now(),
            },
          },
        })),

      indexConversationMessage: (threadId, message) =>
        set((s) => {
          const trimmed = message.t.trim();
          if (!trimmed) return s;
          const nextEntry = buildConversationMemoryEntry(threadId, {
            who: message.who,
            t: trimmed,
          });
          const next = [nextEntry, ...s.conversationMemory];
          return {
            conversationMemory: next.length > MEMORY_CAP ? next.slice(0, MEMORY_CAP) : next,
          };
        }),

      clearChatThread: (threadId) =>
        set((s) => {
          if (!s.chatThreads[threadId]) return s;
          const { [threadId]: _removed, ...rest } = s.chatThreads;
          return {
            chatThreads: rest,
            conversationMemory: s.conversationMemory.filter((entry) => entry.threadId !== threadId),
          };
        }),

      clearConversationData: () =>
        set({
          chatThreads: {},
          conversationMemory: [],
        }),

      updateThreadSummary: (threadId, summary) =>
        set((s) => {
          const thread = s.chatThreads[threadId];
          if (!thread) return s;
          return {
            chatThreads: {
              ...s.chatThreads,
              [threadId]: { ...thread, summary },
            },
          };
        }),

      removeMessageFromThread: (threadId, index) =>
        set((s) => {
          const thread = s.chatThreads[threadId];
          if (!thread || !thread.messages[index]) return s;
          const removedMsg = thread.messages[index]!;
          const nextMessages = thread.messages.filter((_, i) => i !== index);
          // Strip the corresponding memory entry by text+thread match.
          // Text equality isn't unique in theory, but close enough for a
          // single-device local store — duplicates are rare and harmless.
          const nextMemory = s.conversationMemory.filter(
            (e) => !(e.threadId === threadId && e.text === removedMsg.t),
          );
          return {
            chatThreads: {
              ...s.chatThreads,
              [threadId]: {
                ...thread,
                messages: nextMessages,
                updatedAt: Date.now(),
                summary: undefined, // summary may reference the deleted message
              },
            },
            conversationMemory: nextMemory,
          };
        }),

      // Upsert: also used to refresh a pack in place (version bump). A newly
      // installed region becomes the active one; refreshing the active region
      // re-applies its labelMap so an updated model's class order takes effect.
      installRegion: (id, labelMap, version) =>
        set((s) => {
          const isNew = !s.installedRegions.includes(id);
          const installedRegions = isNew ? [...s.installedRegions, id] : s.installedRegions;
          const becomesActive = isNew || s.activeRegion === id;
          return {
            installedRegions,
            installedPackVersions: { ...s.installedPackVersions, [id]: version },
            activeRegion: becomesActive ? id : s.activeRegion,
            activeLabelMap: becomesActive ? labelMap : s.activeLabelMap,
          };
        }),

      uninstallRegion: (id) =>
        set((s) => {
          const installedRegions = s.installedRegions.filter((r) => r !== id);
          const { [id]: _removed, ...installedPackVersions } = s.installedPackVersions;
          if (s.activeRegion !== id) return { installedRegions, installedPackVersions };
          // The active region went away: fall back to another installed one
          // (if its pack is loaded), otherwise Scan asks for a pack again.
          const next = installedRegions.find((r) => getPackData(r)) ?? null;
          return {
            installedRegions,
            installedPackVersions,
            activeRegion: next,
            activeLabelMap: next ? getPackData(next)!.labelMap : {},
          };
        }),

      setActiveRegion: (id) =>
        set((s) => {
          const pack = getPackData(id);
          if (!s.installedRegions.includes(id) || !pack) return s;
          return { activeRegion: id, activeLabelMap: pack.labelMap };
        }),

      removeMapPin: (catchAt) =>
        set((s) => ({
          catchLog: s.catchLog.map((e) => {
            if (e.at !== catchAt) return e;
            const { lat: _lat, lng: _lng, ...rest } = e;
            return rest;
          }),
        })),

      clearScanCache: async () => {
        const events = get().catchLog;
        const uris = new Set<string>();
        for (const e of events) if (e.photoUri) uris.add(e.photoUri);

        let deleted = 0;
        let bytes = 0;
        for (const uri of uris) {
          try {
            const info = await FileSystem.getInfoAsync(uri);
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
          catchLog: s.catchLog.map((e) => {
            if (!e.photoUri) return e;
            const { photoUri: _photoUri, ...rest } = e;
            return rest;
          }),
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
        // Drop a not-yet-written save of the old data before deleting it.
        persistWriter.cancel();
        await AsyncStorage.removeItem('critterboard:v1');
        // Reset every persisted slice back to a brand-new install.
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
            crashReportingOn: false,
            minConfidence: DEFAULT_MIN_CONFIDENCE,
            hapticsOn: true,
          },
          hasOnboarded: false,
          toast: null,
          lastPhotoUri: null,
          catchLog: [],
          activityLog: [],
          mapLocation: null,
          questProgress: initialQuestProgress(),
          questCompletedAt: {},
          questClaimedAt: {},
          chatThreads: {},
          conversationMemory: [],
          installedRegions: [],
          activeRegion: null,
          activeLabelMap: {},
          installedPackVersions: {},
          // Rotate the backend identity on every wipe so a fresh install
          // and a wiped install look identical to the server.
          backendUserId: newBackendUserId(),
          backendSecret: newBackendSecret(),
          online: EMPTY_ONLINE,
          syncStatus: { phase: 'idle', done: 0, total: 0 },
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
        questClaimedAt: s.questClaimedAt,
        backendUserId: s.backendUserId,
        backendSecret: s.backendSecret,
        online: s.online,
        chatThreads: s.chatThreads,
        conversationMemory: s.conversationMemory,
        installedRegions: s.installedRegions,
        activeRegion: s.activeRegion,
        activeLabelMap: s.activeLabelMap,
        installedPackVersions: s.installedPackVersions,
      }),
      /**
       * Skip past onboarding for returning users. The flag is set in
       * Permissions.finish() — without this hook every cold launch
       * would park them back at the welcome screen because the nav
       * stack is intentionally NOT persisted.
       */
      onRehydrateStorage: () => (state) => {
        // Runs after a read and after a failed one, so writes can't stay off forever.
        rehydrated = true;
        useAppStore.setState({
          hydrated: true,
          ...(state?.hasOnboarded ? { stack: [{ name: 'home', params: undefined }] } : {}),
        });
      },
    },
  ),
);

/**
 * The stack entry a screen was rendered for, provided by the Router. A main tab kept mounted in
 * the background keeps its own entry (and params) instead of seeing whatever route is on top.
 */
export const RouteContext = createContext<StackEntry | null>(null);

export function useCurrentRoute(): StackEntry {
  const entry = useContext(RouteContext);
  if (entry) return entry;
  const { stack } = useAppStore.getState();
  return stack[stack.length - 1] as StackEntry;
}
