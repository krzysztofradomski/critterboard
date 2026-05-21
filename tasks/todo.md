# Critterboard — master task tracker

Living checklist of what's shipped and what's left. Treat this as the source of truth for project status; commit changes here in the same commit that lands the work.

`#tasks` `#roadmap`

> See also: [[docs/ml-roadmap]] (on-device ML), [[docs/architecture]] (system overview), [[tasks/archive]] (past plans).

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
- [ ] **1.3 — Real scan-cache deletion** *(AFK, blocked by 1.2)*
  - [ ] Walk `catchLog` URIs, `FileSystem.deleteAsync` each one
  - [ ] Strip the URIs from the events post-delete
  - [ ] Help.tsx "Clear scan cache" toast becomes truthful
- [ ] **1.4 — Completed quests derived from progress** *(AFK)*
  - [ ] Add `questCompletedAt: Record<string, number>` slice
  - [ ] `catchBug` records timestamp when a quest first hits 100%
  - [ ] `CompletedDrawer` consumes `questCompletedAt` (with localized date) instead of static `COMPLETED_QUESTS`
  - [ ] Keep static seed as fallback for empty histories

### Batch 2 — "world feels alive"

Goal: features that hook into real OS APIs we already have permission for.

- [ ] **2.1 — Daily streak nudge notification** *(AFK)*
  - [ ] `src/lib/notify.ts` schedules a single daily local notification at 18:00 local
  - [ ] Scheduling gated on `currentStreak >= 1` and no catch today
  - [ ] Notification body uses the active persona's voice
  - [ ] Cancel + reschedule when a catch lands (so today's notification doesn't fire)
- [ ] **2.2 — GPS-tagged catches on Map** *(AFK)*
  - [ ] Extend `CatchEvent` with optional `lat?: number; lng?: number`
  - [ ] `catchBug` reads position via `expo-location` when `profile.locationShareOn`
  - [ ] Map.tsx renders user's real catches as additional pins (different style from static `SIGHTINGS`)
- [ ] **2.3 — Leaderboard user row reflects real XP** *(AFK)*
  - [ ] Compute user's xp/level via `useXp`/`useLevel`
  - [ ] Replace `LEADERS.self.xp = 24612` with computed value
  - [ ] Re-sort the list (podium may shuffle as user passes synthetic rows)
- [ ] **2.4 — Reverse-geocoded Map header** *(AFK)*
  - [ ] `expo-location.reverseGeocodeAsync(position)` → city / region
  - [ ] Gated on `profile.locationShareOn`; falls back to a "private" label
  - [ ] Cache result in store for 24h so we don't re-geocode on every Map open

### Batch 3 — small polish (one-PR each)

- [ ] **3.1 — Facts table for all 12 species** *(AFK)* — `Result.tsx` populated for every bug, ideally via `bugs.<id>.facts.*` keys
- [ ] **3.2 — Streak calendar date range computed** *(AFK)* — `Intl.DateTimeFormat`, kill the "Apr 14 → May 18" static string
- [ ] **3.3 — "Resets in Xh" computed** *(AFK)* — hours to local midnight, formatted via i18n
- [ ] **3.4 — Onboarding footer reflects network state** *(AFK)* — "✓ no internet" flips to "✓ with internet" when `profile.networkOn`
- [ ] **3.5 — Streak at-risk banner on Home** *(AFK)* — when `currentStreak >= 1` and no catch today, persona sticker shows urgent line
- [ ] **3.6 — Dex completion ribbon** *(AFK)* — celebratory sticker at 50% / 100% of dex
- [ ] **3.7 — Persona switch animation** *(AFK)* — Animated avatar pulse on switch
- [ ] **3.8 — Display-name char counter** *(AFK)* — `N/18` indicator in Settings

### Batch 4 — HITL or gated

- [ ] **4.1 — Quest claim mechanic + XP grant** *(HITL — design call)* — does quest XP stack with catch XP, or is it independent? Decide first
- [ ] **4.2 — App icon + splash screen** *(HITL — needs asset)* — `app.json` wiring is small but needs a designed graphic
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
