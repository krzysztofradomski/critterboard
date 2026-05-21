# Critterboard — master task tracker

Living checklist of what's shipped and what's left. Treat this as the source of truth for project status; commit changes here in the same commit that lands the work.

`#tasks` `#roadmap`

> See also: [[docs/ml-roadmap]] (on-device ML), [[docs/architecture]] (system overview), [[tasks/archive]] (past plans).

---

## Done

### Crash reporting (opt-in)

Sentry behind an opt-in toggle. Off by default; gated by `networkOn`. DSN read from `EXPO_PUBLIC_SENTRY_DSN`; missing DSN or missing native SDK degrades to a console fallback.

- [x] `@sentry/react-native` added to `package.json`
- [x] `src/lib/crashReporting.ts` — `initCrashReporting` / `setCrashReportingEnabled` / `captureException` / `captureMessage`, lazy-loaded via `require()` inside try/catch
- [x] `profile.crashReportingOn` (default `false`) in `useAppStore` + `wipeAll` reset + wire backfill for legacy profiles
- [x] `App.tsx` initializes wrapper at mount and reacts to toggle flips
- [x] `Settings.tsx` — 🛟 toggle below location-share, cascades off when `networkOn` flips off
- [x] i18n keys `settings.crashLabel / crashOn / crashOff / crashNeeds` in en/pl/de/es
- [x] `docs/modules/crash-reporting.md` + `docs/decisions/001-crash-reporting-opt-in.md` + index update
- [x] `npx tsc --noEmit` clean

#### Review

- The wrapper is the single chokepoint for crash reporting — never import `@sentry/react-native` outside `src/lib/crashReporting.ts`.
- The toggle reacts to `networkOn`: turning network off clears `crashReportingOn` in the same `setProfile` call, mirroring the leaderboard/locShare cascade.
- For a real build: `npm install`, set `EXPO_PUBLIC_SENTRY_DSN`, then run with a dev client (Expo Go won't capture native crashes).

---

## Done

Most-recent batches first. Older work below the "Foundation" heading.

### Tier C — completeness ([commit 3e0c12a](https://github.com/anthropics/critterboard))

- [x] Streak freezes derived from catch history (`computeFreezeState`, ❄ in calendar)
- [x] Recent finds strip on Home — `useRecentBugIds(4)`
- [x] `wipeAll` store action — clears AsyncStorage, resets every slice, lang preserved
- [x] Badges derived from catch data (`useBadges` over `BADGES` static)

### Tier B — real progression ([commit b883cfc](https://github.com/anthropics/critterboard))

- [x] `catchLog` + `activityLog` + `questProgress` slices in store, persisted
- [x] `src/lib/streak.ts` — local-day bucketing, `currentStreak`/`bestStreak`/`calendarGrid`, seed builder
- [x] `src/lib/quests.ts` + `BUGS.traits` + `QUEST_RULES` — catches bump matching counters
- [x] `src/lib/timeAgo.ts` — i18n-aware relative timestamps
- [x] Streak.tsx drops hard-coded `cur=4/best=11/total=142/PATTERN`
- [x] Home week strip + streak pill from real data; days-to-badge computed
- [x] Quests.tsx + `QuestCard` read live progress via `useQuests()`
- [x] Activity.tsx renders real entries with `timeAgo`, three kinds (catch/persona/streak)
- [x] New i18n keys for activity (`kind.*`, `when.*`) in all four packs

### Tier A — derived numbers ([commit 1588c7e](https://github.com/anthropics/critterboard))

- [x] `hasOnboarded` persisted; `onRehydrateStorage` skips returning users past onboarding
- [x] `followed: Set<string>` persisted; Friends screen reads from store
- [x] `src/lib/level.ts` — `xpFromDex` / `levelFromXp` / `rankFromXp` / `formatXp` + selector hooks
- [x] `src/lib/bugOfDay.ts` — day-of-year rotation through the legendary pool
- [x] Home stat tiles (CAUGHT / XP / RANK) derived live
- [x] Quests level + xpCurrent + xpNext + progress bar derived
- [x] `Permissions.finish()` calls `setOnboarded(true)`

### Localization — EN / PL / DE / ES

See [[tasks/archive/2026-05-localization]] for the full plan + review. Highlights:

- [x] Tiny custom i18n module (~150 lines, no new deps)
- [x] All four packs bundled, English is fallback source of truth
- [x] OTA loader dormant by default; `setPackManifestUrl(url)` enables it
- [x] Settings → Language picker is real, persisted
- [x] Data files (BUGS / REGIONS / BADGES / QUESTS / FRIENDS / PERSONAS) stripped of display strings

### MVP scaffolding — real device features

- [x] Real camera (`expo-camera` `CameraView`) + `takePictureAsync`
- [x] Image picker (`expo-image-picker`) wired to the 🖼️ button
- [x] Result.tsx shows captured photo via `Image`
- [x] Real OS permission requests in Permissions.tsx
- [x] Zustand `persist` middleware + AsyncStorage adapter (Set ↔ array)
- [x] Haptics on shutter / catch / persona switch / no-match (`src/lib/haptics.ts`)
- [x] Persona system prompts threaded through `mockRuntime.completeWithPersona`
- [x] iOS Info.plist + Android manifest permission strings in `app.json`

### AI seams (scaffolded, awaiting real models)

- [x] `src/ai/vision.ts` — `VisionClassifier` interface, `mockClassifier` (default) + `nativeClassifier` (throws)
- [x] `src/ai/llm.ts` — `LlmRuntime` interface mirroring `llama.rn`'s streaming API
- [x] `src/ai/index.ts` — single switchboard with `USE_NATIVE_VISION` / `USE_LLAMA_RN` flags
- [x] `src/ai/chat.ts` — back-compat shim over the new seam
- [x] `assets/models/README.md` — exact wiring instructions for the bundle slot

### Training pipelines (full scaffolds, runnable when needed)

- [x] `training/local/` — 20-species M2 mini run (`01_setup_and_download` → `04_export`)
- [x] `training/kaggle/insect_classifier_training.ipynb` — full EU run on T4 ×2
- [x] `training/personas/` — five-step LoRA pipeline (seed → curate → train → eval → export GGUF)
- [x] `training/personas/examples/{larva,snail,maywind}.jsonl` — 10 hand-written examples each
- [x] `training/personas/kaggle/persona_lora_training.ipynb` — T4 ×2 LoRA notebook
- [x] [[docs/ml-roadmap]] — three-track master plan, exit criteria per tier

### Foundation

- [x] React Native + TypeScript port of the prototype (20 screens, 54 source files)
- [x] Zustand store consolidating nav stack + dex + persona + profile + toast
- [x] Type-safe routes (`RouteParamMap`, `nav.go(route, params)` is type-checked)
- [x] Shared primitives in `src/components/` (Btn, Sticker, IconBtn, TabBar, dialogs, modals)
- [x] PB design tokens — colors, ink-border + hard-offset shadow recipes
- [x] Custom Router + Screen fade-up wrapper

### Batch 1 — "make the privacy story true" (review)

Shipped in four commits on `main`:

- `414abe5` — 1.1 real data export (`src/lib/export.ts`, `expo-sharing`)
- `d3850f7` — 1.2 per-catch photo persistence (`CatchEvent.photoUri`, Dex tile lookup, Activity thumbnail)
- `7d8cbb9` — 1.3 real scan-cache deletion (`clearScanCache` action, truthful toast)
- 1.4 — completed quests from real timestamps (`questCompletedAt` slice, `useCompletedQuests`, localized date in `CompletedDrawer`)

Every claim Help/Settings makes about "your data lives on your phone, take it with you" is now literally true: export gives you the actual JSON/CSV via the OS share sheet; the clear button deletes the actual files and reflects what was freed; completed quests show real catch history (with the static seed as a fallback). All four i18n packs updated; `npm run typecheck` clean throughout.

---

## Remaining

Each item is a tracer-bullet vertical slice — touches data / store / UI / i18n in one PR. AFK = agent can ship without human review; HITL = needs a design call or external artifact.

### Batch 1 — "make the privacy story true"

Goal: every claim in Help / Settings about local-first data ownership becomes literally true.

- [x] **1.1 — Real data export** *(AFK)*
  - [x] Add `expo-sharing` dep
  - [x] `src/lib/export.ts` builds JSON (dex) and CSV (sightings) blobs from `dex` + `catchLog`
  - [x] Help.tsx export buttons call into it + `Sharing.shareAsync`
  - [x] Toast updates with the actual filename
- [x] **1.2 — Per-catch photo persistence** *(AFK)*
  - [x] Extend `CatchEvent` with optional `photoUri?: string`
  - [x] `useAppStore.catchBug` accepts photo URI, stores it on the event
  - [x] `Scan.tsx` passes the captured/picked URI when calling `catchBug` (routed via Result params)
  - [x] Dex grid swap: tap a caught bug → Result with that URI instead of the default `CameraScene`
  - [x] Activity feed entries render the real thumbnail
- [x] **1.3 — Real scan-cache deletion** *(AFK)*
  - [x] Walk `catchLog` URIs, `FileSystem.deleteAsync` each one
  - [x] Strip the URIs from the events (and activity entries) post-delete
  - [x] Help.tsx "Clear scan cache" toast becomes truthful (`N photos · M MB`)
- [x] **1.4 — Completed quests derived from progress** *(AFK)*
  - [x] Add `questCompletedAt: Record<string, number>` slice
  - [x] `catchBug` records timestamp when a quest first hits 100%
  - [x] `CompletedDrawer` consumes `questCompletedAt` (with localized date) instead of static `COMPLETED_QUESTS`
  - [x] Keep static seed as fallback for empty histories

### Batch 2 — "world feels alive"

Goal: features that hook into real OS APIs we already have permission for.

- [x] **2.1 — Daily streak nudge notification** *(AFK)*
  - [x] `src/lib/notify.ts` schedules a single daily local notification at 18:00 local
  - [x] Scheduling gated on `currentStreak >= 1` and no catch today
  - [x] Notification body uses the active persona's voice (`personas.<id>.streakSass`)
  - [x] Cancel + reschedule on every catchLog/persona/language change (App.tsx effect)
- [x] **2.2 — GPS-tagged catches on Map** *(AFK)*
  - [x] Extend `CatchEvent` with optional `lat?: number; lng?: number`
  - [x] `catchBug` accepts opts; Result.tsx reads position via `expo-location` when `profile.locationShareOn` (2.5s GPS budget, never blocks the catch)
  - [x] Map.tsx renders user's real catches as diamond pins, projected from the newest user catch via a coarse equirectangular formula
- [x] **2.3 — Leaderboard user row reflects real XP** *(AFK)*
  - [x] Compute user's xp via `useXp`
  - [x] Replace static `LEADERS.self.xp = 24612` with the derived value
  - [x] Re-sort the roster by XP desc + renumber ranks; podium pulls from the resorted top 3
- [x] **2.4 — Reverse-geocoded Map header** *(AFK)*
  - [x] `src/lib/geocode.ts` calls `getCurrentPositionAsync` + `reverseGeocodeAsync`
  - [x] Gated on `profile.locationShareOn`; renders `map.locNamePrivate` when off
  - [x] Cache persisted in `mapLocation` store slice, 24h TTL, refreshed on every Map mount + share-toggle change

### Batch 2 — "world feels alive" (review)

Shipped in four commits on `main`:

- `8256bc6` — 2.1 daily streak nudge notification (`src/lib/notify.ts`, persona-voiced body, App.tsx effect)
- `7e998fe` — 2.2 GPS-tagged catches on Map (`CatchEvent.lat/lng`, equirectangular projection, diamond pins)
- `10b100f` — 2.3 leaderboard with real XP (full re-sort + renumber)
- 2.4 — reverse-geocoded Map header (`mapLocation` slice + 24h TTL in `src/lib/geocode.ts`)

The app now reacts to real OS state. The streak nudge speaks in the active persona, real catches drop pins where the user was standing, the leaderboard re-orders itself live, and the Map header reads the actual city/region (or shows a private label when share is off).

### Batch 3 — small polish (one-PR each)

- [x] **3.1 — Facts table for all 12 species** *(AFK)* — `Result.tsx` populated for every bug via 4-fact tiles (habitat/wingspan-or-size/range/diet-or-active). 20 new value keys (`gardens`/`ponds`/`eaves`/per-bug sizes/`tropics`/`europe`/`seAsia`/`insects`/`aphids`/`sap`/`leaves`/`fruit`) added in en/pl/de/es
- [x] **3.2 — Streak calendar date range computed** *(AFK)* — `Intl.DateTimeFormat(lang, {month:'short', day:'numeric'})` over the trailing 35-day window
- [x] **3.3 — "Resets in Xh" computed** *(AFK)* — `Math.ceil((midnight - now) / 3 600 000)` (min 1H); `{h}` placeholder in `quests.daily`
- [x] **3.4 — Onboarding footer reflects network state** *(AFK)* — `onboarding.legalOnline` picked when `profile.networkOn`
- [x] **3.5 — Streak at-risk banner on Home** *(AFK)* — when streak ≥ 1 and `week.today.caught === false`, persona sticker swaps to red bg + `streakSass` line
- [x] **3.6 — Dex completion ribbon** *(AFK)* — purple "Halfway there" at 50 %, gold "Full dex!" at 100 % (purple loses to gold)
- [x] **3.7 — Persona switch animation** *(AFK)* — `Animated` 1 → 1.18 → 1 spring on the active avatar in `PersonaPick`
- [x] **3.8 — Display-name char counter** *(AFK)* — `N/18` next to the section label, turns red at the cap

### Batch 3 — small polish (review)

Shipped in three commits on `main`:

- `9b9a513` — 3.1 facts table for all 12 species (20 new value keys × 4 packs)
- `3a08a88` — 3.2 calendar range + 3.3 reset countdown (`Intl.DateTimeFormat` + ceil-to-midnight math)
- 3.4 – 3.8 — onboarding footer toggle, Home at-risk banner, Dex 50 %/100 % ribbon, persona pulse animation, name char counter (one commit)

Every visible "fake number" or "fake date" from the prototype is now derived. Settings/Help promises about local-only data export and per-catch photos are now demonstrable.

### Batch 4 — HITL or gated

- [x] **4.1 — Quest claim mechanic + XP grant** *(decided: STACK)* — claimed quest reward stacks on top of catch XP via `xpFromClaimedQuests`. New `questClaimedAt` store slice + `claimQuest(id)` action; QuestDialog shows Claim → Claimed states; QuestCard pill swaps to a gold "✨ CLAIM +N" then dims to "✓ CLAIMED" after
- [x] **4.2 — App icon + splash screen** *(AFK)* — butterfly icon + stickerbug splash wired into `app.json` (iOS `icon`, Android `adaptiveIcon.foregroundImage` on `#ffffff`, splash `image` with `resizeMode: cover`). Source assets in `assets/icons/` and `assets/splashes/`
- [ ] **4.3 — Wire real insect classifier** *(HITL — gated)* — flip `USE_NATIVE_VISION` once `assets/models/insect_classifier.{mlpackage,onnx}` exists. See [[docs/ml-roadmap]] § Track 1
- [ ] **4.4 — Wire real Llama runtime** *(HITL — gated)* — flip `USE_LLAMA_RN` once `llama.rn` is added + a GGUF is bundled. See [[docs/ml-roadmap]] § Track 2

---

## Out of scope (deliberately deferred)

These need either a backend or a substantial change and are explicitly **not** on the current roadmap:

### Needs backend
- Real leaderboard / friend graph / suggested feed
- Real activity events from other users
- Cross-device sync (intentionally not in the design — the app is account-less by promise)

### Needs substantial native / infra work
- Real map tiles via `react-native-maps` + provider key + native config
- Real BugNet / Larva-3B / Regional pack downloads — needs CDN + signing
- Real **Sound ID** audio classifier — needs a separate training run on log-mel spectrograms; see [[docs/ml-roadmap]] § 2.4 (called out as an optional Track 2 stretch, ~3 MB model)

### Needs richer classifier output
- Real lookalike-distinguished signal for badge b5 — current classifier returns argmax, not "distinguished mimics"
- Real Quest q1 photo-trait detection (currently driven by stored `BUGS.traits`, not by the classifier inferring "this is a pollinator" from the image)

### Localization stretch
- iOS native locale auto-detection (currently defaults to English on first launch — user opts in via Settings)
- RTL language support — would need `I18nManager.forceRTL()` + layout review
- Translation lint script — diff pack keys vs English source, warn on missing

---

## Workflow

1. Pick a task. Move it to `in-progress` (or just leave the box unchecked and start working).
2. Implement the slice end-to-end in one branch.
3. `npm run typecheck` clean before commit.
4. Tick the box in this file *in the same commit* as the implementation.
5. After a batch lands, summarize in a "Review" section here and link the commit hash.

Lessons learned mid-task go in [[tasks/lessons]].
