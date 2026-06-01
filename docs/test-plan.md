# Critterboard Test Plan

## 1. Recommended Setup

### Test Frameworks

| Layer | Tool | Rationale |
|-------|------|-----------|
| Unit & integration | **Vitest** | Zero-config TypeScript, fast watch mode, Jest-compatible API, works outside Metro |
| Component tests | **React Native Testing Library (RNTL)** | Mirrors user interaction, pairs with Vitest |
| E2E (mobile) | **Detox** | Grey-box, runs on real iOS/Android simulators; official Expo support |
| E2E (web/CI fallback) | **Playwright** | Headless Chromium for `expo start --web`; faster in CI than Detox |
| Cloudflare Worker | **Vitest + Miniflare** | Runs worker handlers in process without deploying |

### Installation

```bash
# Unit + component
npm install -D vitest @testing-library/react-native @testing-library/jest-native \
  react-test-renderer react-native-gesture-handler \
  @testing-library/user-event msw

# E2E mobile
npm install -D detox detox-expo-plugin

# E2E web (CI)
npm install -D @playwright/test

# Worker testing
cd worker && npm install -D miniflare vitest
```

### Configuration Files

**`vitest.config.ts`** (root)
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

**`src/__tests__/setup.ts`**
```typescript
import '@testing-library/jest-native/extend-expect';
// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
// Mock expo-camera, expo-location, expo-notifications
jest.mock('expo-camera', () => ({ useCameraPermissions: () => [{ granted: true }, jest.fn()] }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn() }));
jest.mock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn() }));
// Silence Reanimated warnings in test
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);
```

**`package.json` scripts additions**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "detox test --configuration ios.sim.debug",
  "test:e2e:web": "playwright test"
}
```

### Directory Layout

```
src/
  __tests__/
    setup.ts
    unit/
      lib/
      store/
      i18n/
      ai/
      backend/
      data/
    components/
    screens/
e2e/
  detox/
    flows/
  playwright/
    flows/
worker/
  src/__tests__/
```

---

## 2. Unit Tests

### 2.1 `lib/streak.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-S-01 | No catches → streak 0 | `[]` | `{ current: 0, longest: 0 }` |
| U-S-02 | Single catch today → streak 1 | `[today]` | `{ current: 1, longest: 1 }` |
| U-S-03 | Consecutive days → correct streak | `[today, yesterday, 2dAgo]` | `{ current: 3 }` |
| U-S-04 | Gap in chain resets current | `[today, 3dAgo, 4dAgo]` | `{ current: 1, longest: 2 }` |
| U-S-05 | Multiple catches same day count once | `[today, today, today]` | `{ current: 1 }` |
| U-S-06 | Milestone thresholds 3/7/14/30 detected | streak 7 | `isMilestone(7) === true` |
| U-S-07 | Non-milestone value rejected | streak 5 | `isMilestone(5) === false` |
| U-S-08 | Streak across month boundary | catches spanning Feb→Mar | streak continues correctly |
| U-S-09 | Far-future date in log | tomorrow ISO string | streak not incremented |

### 2.2 `lib/level.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-L-01 | 0 XP → level 1 | `0` | `{ level: 1, xpToNext: threshold }` |
| U-L-02 | Exact threshold → level up | XP equal to threshold | next level |
| U-L-03 | XP just below threshold → same level | threshold - 1 | same level |
| U-L-04 | Large XP → correct high level | 50000 | expected level number |
| U-L-05 | `progressPercent` stays 0–100 | random XP values | value in `[0, 100]` |
| U-L-06 | `levelLabel` returns non-empty string | any valid level | truthy string |

### 2.3 `lib/badge.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-B-01 | No catches → no badges | empty dex | `[]` |
| U-B-02 | Catch 1 bug → "First Catch" badge | 1 species in dex | badge awarded |
| U-B-03 | Complete set → "Completionist" badge | all species | badge awarded |
| U-B-04 | Streak 7 → streak badge | streak 7 | badge awarded |
| U-B-05 | Legendary rarity catch → badge | legendary bug | badge awarded |
| U-B-06 | Re-evaluating same state → no duplicates | stable state | badges idempotent |
| U-B-07 | Badges for each defined threshold | full `data/badges.ts` | all badges reachable |

### 2.4 `lib/quests.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-Q-01 | No catches → 0 progress on all quests | empty log | all at 0 |
| U-Q-02 | Pollinator quest: catch 3 pollinators | 3 pollinator species | quest complete |
| U-Q-03 | Pollinator quest: mixed catches | 2 pollinators + 1 beetle | progress 2/3 |
| U-Q-04 | Daily quest resets at midnight | old log entries | not counted toward daily |
| U-Q-05 | Weekly quest resets on Monday | catches from previous week | not counted |
| U-Q-06 | Quest with min-rarity rule | 2 common + 1 rare | only rare counted |
| U-Q-07 | `canClaim` only when progress === goal | progress 2/3 | `canClaim === false` |
| U-Q-08 | Streak quest counts streak correctly | streak 5 | progress 5 |

### 2.5 `lib/bugOfDay.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-BOD-01 | Same date → same bug | date `2026-01-01` (×2) | identical result |
| U-BOD-02 | Different date → different bug (usually) | 365 consecutive dates | at least 2 unique bugs |
| U-BOD-03 | Returns valid bug from catalog | any date | bug ID in `data/bugs.ts` |
| U-BOD-04 | No external state (pure function) | no store access | result depends only on date |

### 2.6 `lib/timeAgo.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-T-01 | 30 seconds ago | `now - 30s` | `"just now"` or seconds label |
| U-T-02 | 90 seconds ago | `now - 90s` | `"1 minute ago"` |
| U-T-03 | 2 hours ago | `now - 2h` | `"2 hours ago"` |
| U-T-04 | Yesterday | `now - 25h` | `"yesterday"` or `"1 day ago"` |
| U-T-05 | 8 days ago | `now - 8d` | `"8 days ago"` or date string |
| U-T-06 | Future date | `now + 1h` | does not throw, returns a string |

### 2.7 `lib/conversationMemory.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-CM-01 | Index empty history | `[]` | empty index |
| U-CM-02 | Retrieve relevant context for query | indexed messages + query | returns ordered results |
| U-CM-03 | Deduplication: same message twice | add same message twice | appears once in index |
| U-CM-04 | Cross-thread retrieval | threads A & B | matches from both |
| U-CM-05 | Context window capped | more than max messages | respects limit |

### 2.8 `i18n/translate.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-I-01 | Known key in loaded pack | `"home.title"`, en | English string |
| U-I-02 | Fallback to English for missing key in other locale | `"key"`, de (pack has no key) | English fallback |
| U-I-03 | Interpolation `{{name}}` replaced | key with `{{name}}`, `{ name: "Ada" }` | `"…Ada…"` |
| U-I-04 | Missing key returns key itself | `"nonexistent.key"` | `"nonexistent.key"` |
| U-I-05 | Locale switch loads correct pack | switch en→de | German strings returned |
| U-I-06 | Nested key path resolves | `"settings.language.label"` | correct leaf value |
| U-I-07 | All en-pack keys have no `undefined` values | en pack | all values are strings |

### 2.9 `i18n/registry.ts` + `i18n/loader.ts`

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-IR-01 | Register pack, then retrieve | register de pack | retrieved correctly |
| U-IR-02 | Overwrite same locale | register en twice | second wins |
| U-IR-03 | Loader merges remote pack into registry | mocked HTTP response | registry updated |
| U-IR-04 | Loader fails gracefully on network error | fetch throws | registry unchanged, no crash |

### 2.10 `store/useAppStore.ts` — Actions

| # | Test case | Action | Expected state change |
|---|-----------|--------|----------------------|
| U-ST-01 | `go('Dex')` pushes route | initial stack `['Home']` | stack `['Home','Dex']` |
| U-ST-02 | `back()` pops stack | stack `['Home','Dex']` | stack `['Home']` |
| U-ST-03 | `back()` at root does not pop | stack `['Home']` | stack unchanged |
| U-ST-04 | `catchBug(bug)` adds to dex | bug not in dex | dex has bug, XP increased |
| U-ST-05 | `catchBug` duplicate → XP still awarded | bug already in dex | XP increases, dex unchanged |
| U-ST-06 | `catchBug` emits activity log entry | any bug | activityLog has new entry |
| U-ST-07 | `claimQuest` marks quest claimed | completed quest | `questClaimedAt` updated |
| U-ST-08 | `claimQuest` on incomplete quest → no-op | progress < goal | state unchanged |
| U-ST-09 | `setPersona` changes persona + logs activity | valid persona id | persona updated, activity entry |
| U-ST-10 | `wipeAll()` resets progression | dex/catchLog non-empty | dex `{}`, catchLog `[]` |
| U-ST-11 | `wipeAll()` preserves language | language set to `'de'` | language still `'de'` after wipe |
| U-ST-12 | `follow` / `unfollow` toggles set | userId | `followed` set updated |
| U-ST-13 | `activityLog` capped at 50 entries | 60 catches | log length ≤ 50 |
| U-ST-14 | Persistence serialises Sets to arrays | followed Set | serialised JSON has array |
| U-ST-15 | Rehydration deserialises arrays back to Sets | JSON with array | `followed` is a Set |
| U-ST-16 | Legacy migration adds `crashReportingOn` | old state without field | field defaulted to `false` |

### 2.11 `backend/mock.ts`

| # | Test case | Method | Expected |
|---|-----------|--------|----------|
| U-BE-01 | `getLeaderboard('global')` returns ranked list | — | array sorted by XP desc |
| U-BE-02 | `getLeaderboard('weekly')` returns weekly scope | — | different/filtered list |
| U-BE-03 | `getFriends` returns follow graph | — | `{ following, followers, suggested }` |
| U-BE-04 | `getFeed` returns events array | — | non-empty array |
| U-BE-05 | `postCatch` increments user XP | new catch | XP higher on next fetch |
| U-BE-06 | `auth` returns JWT-shaped token | device UUID | string with correct format |

### 2.12 `ai/chatAdapter.ts` (mock adapter)

| # | Test case | Inputs | Expected |
|---|-----------|--------|----------|
| U-AI-01 | Mock adapter returns streamed response | any prompt | resolves to non-empty string |
| U-AI-02 | Persona system prompt included in request | persona `larva` | request contains larva system prompt |
| U-AI-03 | Conversation history passed correctly | multi-turn thread | messages array in correct order |
| U-AI-04 | Error in adapter propagates | adapter throws | caller receives error |
| U-AI-05 | `switchAdapter('mock')` returns mock | — | mock adapter active |

### 2.13 `data/` — Integrity

| # | Test case | Dataset | Expected |
|---|-----------|---------|----------|
| U-DA-01 | Every bug has required fields | `data/bugs.ts` | `id, name, emoji, rarity, xp` all defined |
| U-DA-02 | Bug IDs are unique | `data/bugs.ts` | no duplicate IDs |
| U-DA-03 | Rarity values are valid enum members | all bugs | rarity in `['common','uncommon','rare','legendary']` |
| U-DA-04 | Every quest references valid bug filter | `data/quests.ts` | filter values match bug traits |
| U-DA-05 | Quest IDs are unique | `data/quests.ts` | no duplicates |
| U-DA-06 | Badge thresholds are positive integers | `data/badges.ts` | all thresholds > 0 |
| U-DA-07 | i18n keys referenced in data exist in en pack | quests, badges | no missing translation keys |

---

## 3. Component Tests (RNTL)

### 3.1 `components/Toast.tsx`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-TO-01 | Renders with message text | `<Toast message="Hello" />` | text "Hello" in tree |
| C-TO-02 | Auto-dismisses after timeout | advance timers by duration | component unmounts / hidden |
| C-TO-03 | Does not render when message is null | no message prop | nothing rendered |

### 3.2 `components/QuestCard.tsx`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-QC-01 | Shows quest title and description | quest fixture | both texts visible |
| C-QC-02 | Progress bar at correct fill % | progress 2/5 | bar width ~ 40 % |
| C-QC-03 | "Claim" button enabled when complete | progress 5/5 | button pressable |
| C-QC-04 | "Claim" button disabled when incomplete | progress 2/5 | button disabled |
| C-QC-05 | Pressing "Claim" calls callback | complete quest | `onClaim` called once |

### 3.3 `components/ProgressBar.tsx`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-PB-01 | 0 % renders empty bar | `value={0}` | fill width 0 |
| C-PB-02 | 100 % renders full bar | `value={100}` | fill width equals container |
| C-PB-03 | Clamps values outside 0–100 | `value={-10}` / `value={110}` | no crash, clamped display |

### 3.4 `components/TabBar.tsx`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-TB-01 | Renders all tab labels | render with store | all 5 tab names visible |
| C-TB-02 | Active tab highlighted | current route matches tab | active style applied |
| C-TB-03 | Pressing tab navigates | press "Dex" tab | `go('Dex')` called |

### 3.5 `components/BadgeDialog.tsx`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-BD-01 | Shows badge name and description | badge fixture | texts present |
| C-BD-02 | Dismiss button closes dialog | press dismiss | `onClose` called |

### 3.6 `components/PersonaPick.tsx`

| # | Test case | Setup | Expected |
|---|-----------|-------|----------|
| C-PP-01 | Lists all three personas | render | larva/snail/maywind all visible |
| C-PP-02 | Selecting persona calls callback | press "Snail" | `onSelect('snail')` |
| C-PP-03 | Current persona visually selected | currentPersona = 'larva' | larva item highlighted |

---

## 4. Screen-Level Integration Tests

> These use RNTL with a real Zustand store (not mocked) to test screen ↔ store integration.

### 4.1 `screens/Home.tsx`

| # | Test case | State | Expected |
|---|-----------|-------|----------|
| S-HO-01 | Shows bug of the day | empty store | bug name from deterministic selection |
| S-HO-02 | Shows correct streak count | streak 5 | "5 day streak" displayed |
| S-HO-03 | Shows 0 streak on first launch | empty catch log | "0" or "Start your streak" |
| S-HO-04 | Recent catches list renders | 3 catch log entries | 3 items shown |
| S-HO-05 | Tapping bug of day navigates to Dex entry | press bug card | route includes Dex |

### 4.2 `screens/Dex.tsx`

| # | Test case | State | Expected |
|---|-----------|-------|----------|
| S-DX-01 | Shows all 40 species | any store | 40 list items |
| S-DX-02 | Caught species visually distinct | 5 species in dex | 5 items marked as caught |
| S-DX-03 | Search filters list | type "bee" | only bee species shown |
| S-DX-04 | Tapping species shows detail | press item | name + description visible |
| S-DX-05 | Rarity filter works | filter "legendary" | only legendary species shown |

### 4.3 `screens/Quests.tsx`

| # | Test case | State | Expected |
|---|-----------|-------|----------|
| S-QU-01 | Shows all active quests | store with quests | 4 quest cards |
| S-QU-02 | Progress displayed per quest | partial progress | progress bars correct |
| S-QU-03 | Claim button flows through store | complete quest → press Claim | `questClaimedAt` set, XP added |
| S-QU-04 | Already-claimed quest shows "Claimed" | quest claimed | button replaced by label |
| S-QU-05 | Daily quests show time until reset | any state | "Resets in Xh" label |

### 4.4 `screens/Leaderboard.tsx`

| # | Test case | State | Expected |
|---|-----------|-------|----------|
| S-LB-01 | Global tab shows ranked users | backend mock | ranked list rendered |
| S-LB-02 | Switching to Weekly tab changes data | press Weekly | different ordering |
| S-LB-03 | Current user highlighted | user in list | user row visually distinct |
| S-LB-04 | Users with `leaderboardOn: false` hidden | mock returns filtered | private users not shown |

### 4.5 `screens/Settings.tsx`

| # | Test case | Action | Expected |
|---|-----------|--------|----------|
| S-SE-01 | Toggle network updates | press toggle | `networkOn` flipped in store |
| S-SE-02 | Toggle leaderboard visibility | press toggle | `leaderboardOn` flipped |
| S-SE-03 | Toggle crash reporting | press toggle | `crashReportingOn` flipped |
| S-SE-04 | Language picker changes language | select 'de' | `language` set to 'de', UI in German |
| S-SE-05 | "Wipe data" confirmation dialog | press wipe | confirmation modal appears |
| S-SE-06 | Confirm wipe clears store | confirm wipe | dex empty, catchLog empty |

### 4.6 `screens/Onboarding.tsx`

| # | Test case | State | Expected |
|---|-----------|-------|----------|
| S-ON-01 | Shown to new users | `hasOnboarded: false` | onboarding screen rendered |
| S-ON-02 | Skipped for returning users | `hasOnboarded: true` | Home rendered instead |
| S-ON-03 | Completing onboarding sets flag | finish flow | `hasOnboarded: true` in store |
| S-ON-04 | Name entry persisted | enter name "Ada" | `profile.name === "Ada"` |

### 4.7 `screens/Result.tsx`

| # | Test case | State | Expected |
|---|-----------|-------|----------|
| S-RE-01 | High-confidence result shown directly | confidence ≥ threshold | top match displayed |
| S-RE-02 | Low confidence shows disambiguation | confidence < threshold | multiple candidates |
| S-RE-03 | "Log catch" button triggers `catchBug` | press log | bug in dex, XP updated |
| S-RE-04 | "Chat" button opens chat with bug context | press chat | Chat screen with bug prefilled |
| S-RE-05 | No match routes to NoMatch screen | no candidates | NoMatch screen rendered |

---

## 5. Cloudflare Worker Tests (`worker/src/__tests__/`)

> Use **Miniflare** to simulate the Worker runtime + D1 + KV bindings.

| # | Test case | HTTP | Expected |
|---|-----------|------|----------|
| W-01 | `POST /v1/auth` with new UUID creates user | body: `{ deviceId }` | 200, JWT returned |
| W-02 | `POST /v1/auth` with existing UUID returns same user | same UUID twice | same userId both times |
| W-03 | `GET /v1/identity` with valid JWT returns profile | auth header | profile JSON |
| W-04 | `GET /v1/identity` with no auth → 401 | no header | 401 |
| W-05 | `POST /v1/catches` stores catch in D1 | valid JWT + catch body | 200, catch persisted |
| W-06 | `GET /v1/leaderboard?scope=global` returns sorted list | — | array sorted desc by XP |
| W-07 | `GET /v1/leaderboard?scope=weekly` returns weekly data | — | weekly-scoped results |
| W-08 | `POST /v1/follows/:userId` creates follow row | valid user | 200, follow in D1 |
| W-09 | `DELETE /v1/follows/:userId` removes follow | existing follow | 200, row removed |
| W-10 | `GET /v1/friends` returns follow graph | authenticated | `{ following, followers, suggested }` |
| W-11 | `GET /v1/feed` returns user's feed | authenticated | array of events |
| W-12 | Posting catch fans out to followers' feeds | user A follows B; B posts | A's feed has B's catch |
| W-13 | Leaderboard KV cache hit avoids D1 query | warm cache | response headers show cache |
| W-14 | Cron handler refreshes KV leaderboard | invoke scheduled handler | KV updated |
| W-15 | CORS headers present on all responses | any request | `Access-Control-Allow-Origin` set |
| W-16 | Expired JWT → 401 | expired token | 401 |

---

## 6. End-to-End Tests

### 6.1 Detox (iOS Simulator / Android Emulator)

#### 6.1a Onboarding Flow

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E-OB-01 | First launch shows onboarding | fresh install | onboarding screen visible |
| E-OB-02 | Complete onboarding lands on Home | tap through all steps | Home screen visible |
| E-OB-03 | Name entered during onboarding persists | enter "Ada", complete | "Ada" shown on profile |
| E-OB-04 | Permission screen requests camera | tap Camera button | OS permission dialog appears |

#### 6.1b Scan & Identify

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E-SC-01 | Tap Scan tab opens camera | tap Scan in TabBar | camera viewfinder visible |
| E-SC-02 | Capture photo transitions to Result | tap shutter | loading indicator → Result screen |
| E-SC-03 | Result screen shows identified bug | mock AI response | bug name displayed |
| E-SC-04 | "Log Catch" adds bug to Dex | press Log | navigate to Home; dex count +1 |
| E-SC-05 | Low confidence shows picker | mock low-confidence result | disambiguation list shown |

#### 6.1c Quest Completion

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E-QU-01 | Log required bugs, quest completes | catch 3 pollinators | quest shows 3/3 |
| E-QU-02 | Claim quest awards XP | press Claim | XP counter increases |
| E-QU-03 | Claimed quest cannot be re-claimed | press Claim twice | second press no-ops |

#### 6.1d Streak & Milestone

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E-ST-01 | First catch starts streak | catch 1 bug | streak counter shows 1 |
| E-ST-02 | Streak milestone screen shown at 3 | mock 3-day streak | milestone animation screen |
| E-ST-03 | Streak resets after 48h gap | mock stale log | streak shows 0 or 1 |

#### 6.1e Settings & Preferences

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E-SET-01 | Switch language to German | Settings → Deutsch | UI renders in German |
| E-SET-02 | Wipe data clears Dex | wipe + confirm | Dex shows 0 caught |
| E-SET-03 | Toggle off leaderboard visibility | toggle off | profile hidden on Leaderboard |

#### 6.1f Navigation

| # | Test case | Steps | Expected |
|---|-----------|-------|----------|
| E-NAV-01 | All 5 tabs navigate correctly | tap each tab | correct screen renders |
| E-NAV-02 | Back from Dex returns to Home | Dex → back | Home visible |
| E-NAV-03 | Deep stack pops on multiple backs | Home→Dex→Result→back×2 | Home reached |

### 6.2 Playwright (Web / CI)

> Run via `expo start --web` on CI; intended as a smoke-test tier for routes that work in browser.

| # | Test case | URL/Action | Expected |
|---|-----------|-----------|----------|
| E-PW-01 | App loads without JS errors | `/` | no console errors |
| E-PW-02 | Home screen renders | wait for `testID=home-screen` | element present |
| E-PW-03 | TabBar navigation works | click Dex tab | `testID=dex-screen` present |
| E-PW-04 | Dex search filters species | type "wasp" in search | only wasp entries shown |
| E-PW-05 | Settings language toggle reflects in DOM | select German | German text visible |
| E-PW-06 | Onboarding skipped for returning session | localStorage set | home rendered directly |

---

## 7. Coverage Targets

| Area | Target |
|------|--------|
| `lib/` utility functions | 90 % |
| `store/` actions + selectors | 85 % |
| `i18n/` translation engine | 90 % |
| `data/` integrity tests | 100 % |
| `backend/mock.ts` | 80 % |
| `ai/chatAdapter.ts` (mock) | 75 % |
| Component tests | 70 % |
| Screen integration tests | key happy-paths |
| Worker API handlers | 85 % |
| E2E Detox flows | core flows |

---

## 8. CI Integration

Recommended GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test -- --coverage
      - run: cd worker && npm ci && npm test

  e2e-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci && npx playwright install --with-deps chromium
      - run: npx expo export --platform web
      - run: npm run test:e2e:web

  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx detox build --configuration ios.sim.debug
      - run: npx detox test --configuration ios.sim.debug
```

---

## 9. Priority Order

Given that the project has 0 tests today, a recommended roll-out order:

1. **`lib/` unit tests** — pure functions, fastest to write and highest ROI (streak, level, badge, quests)
2. **`store/` action tests** — core state machine, uncovers hidden bugs in persistence/migration logic
3. **`data/` integrity tests** — prevents silent catalog breakage, runs in milliseconds
4. **`i18n/` tests** — catches missing translations early as packs grow
5. **Worker API tests** — de-risks backend before real deployment
6. **Component tests** — QuestCard, ProgressBar, Toast first (most logic)
7. **Screen integration tests** — Onboarding, Scan→Result→Dex flow, Settings
8. **E2E Playwright (web)** — quick smoke tests, CI-friendly
9. **E2E Detox (mobile)** — full flows, longest to write but highest confidence
