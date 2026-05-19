# Critterboard

Offline-first insect ID app. React Native + TypeScript.

Port of the Claude Design handoff prototype (`Critterboard Prototype.html` in the handoff bundle). The visual language, persona system, and offline framing are all preserved 1:1. Data and AI calls are mocked at the seams under `src/data/` and `src/ai/`.

## Run

```bash
npm install
npm run ios       # or `android`, `web`, `start`
npm run typecheck
```

## Layout

```
src/
  ai/                # mocked on-device chat completion
  components/        # shared primitives — Btn, Sticker, IconBtn, Toast, TabBar, dialogs, modal shell
  data/              # mocked species, quests, leaderboard, badges, regions, person profiles
  navigation/
    routes.ts        # typed route table
    Router.tsx       # registry that maps routes to screens
  personas/          # the three guides (Prof. Larva, Dr. Snail, R.A. Maywind)
  screens/           # one file per screen
  store/
    useAppStore.ts   # Zustand store: nav stack + dex + persona + profile + toast
    useNav.ts        # `useNav()` hook with type-safe `go(route, params)`
  tokens/
    pb.ts            # PB design tokens (colors, fonts, shadow recipes)
```

Each screen is presentational — it pulls state from the Zustand store, dispatches navigation via `useNav()`, and renders with the shared primitives. No `window.*` globals; everything imported. Routes are type-safe end-to-end (`go('result', { id: 'mona' })` typechecks, `go('result')` does not).

## Offline by default

`profile.networkOn` defaults to `false`. The leaderboard, location sharing, and any "social" affordances stay gated behind that flag — flip it off in Settings and the UI tells you nothing leaves the device. The chat model in `src/ai/chat.ts` is a local mock; the contract matches the prototype's `window.claude.complete` so swapping a real on-device runtime later is a one-file change.
