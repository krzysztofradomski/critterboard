# Architecture overview

`#architecture` `#index`

Critterboard is an Expo (SDK 57) React Native app, TypeScript throughout. It runs on iOS, Android and web from one codebase. It is local-first: bug ID, chat and all game state live on the device. The only optional server is a Cloudflare Worker for social features, and it is gated behind the Network toggle in Settings.

> See also: [[deployment]] (EAS builds), [[modules/backend-adapter]] (Cloudflare seam), [[ml-roadmap]] (on-device models), [[i18n]] (language packs).

## Top-level map

```mermaid
flowchart TB
  subgraph Device["📱 Device (Expo / React Native)"]
    App[App.tsx boot effects] --> Router[navigation/Router<br/>Zustand stack]
    Router --> Screens[screens/*<br/>Home · Scan · Dex · Map · Me …]
    Screens --> Store[(store/useAppStore<br/>Zustand + AsyncStorage)]
    Screens --> AI[ai/* seam]
    Screens --> Hooks[backend/hooks]
    AI --> Vision[ExecuTorch .pte from region pack<br/>no pack → install prompt]
    AI --> Chat[llama.rn Gemma 4 E2B GGUF<br/>no model → chat disabled]
    Hooks --> Adapter{backend/index}
    Adapter -->|no URL| Mock[mockAdapter]
    Adapter -->|EXPO_PUBLIC_BACKEND_URL| CF[cloudflareAdapter]
    Screens --> Map[Map screen<br/>MapLibre + local PMTiles<br/>globe behind a flag]
  end

  subgraph Remote["🌐 Remote (all optional)"]
    Worker[worker/ Cloudflare Worker<br/>D1 · KV · Durable Object · Cron]
    GH[GitHub raw + Releases<br/>packs/*.json, eu-ce.pte]
    HF[Hugging Face<br/>Gemma 4 E2B GGUF]
    Sentry[Sentry<br/>opt-in]
  end

  CF -->|JWT, networkOn only| Worker
  App -->|region + i18n packs| GH
  Vision -. model download .-> GH
  Chat -. model download .-> HF
  App -. if opted in .-> Sentry
```

## Folders

| Path | Role |
|---|---|
| `App.tsx` / `index.ts` | Boot: language seeding, region-pack hydrate + refresh, i18n pack sync, crash reporting, streak notification. |
| `src/navigation/` | Type-safe route table + a Zustand-backed stack router (no react-navigation). |
| `src/screens/` | One file per screen. Native `Map.tsx` uses the offline MapLibre map ([[modules/offline-map]]); `Map.web.tsx` still uses the globe. |
| `src/map/` | Offline map style + map-pack download helper. |
| `src/components/` | Shared UI ("sticker" design language, tokens in `src/tokens/pb.ts`). |
| `src/store/` | Single persisted Zustand store: profile, catches, dex, quests, installed packs, backend id. |
| `src/ai/` | Vision + chat seams. Chat is wrapped in regex guardrails (`guardrails.ts`: length, secrets, injection, prompt leakage, PII), the same on every platform. Flags in `src/ai/index.ts`. |
| `src/backend/` | Backend adapter seam, see [[modules/backend-adapter]]. |
| `src/data/` | Static seeds (bugs, sightings, quests, badges, regions) + region-pack loader. |
| `src/i18n/`, `assets/i18n/` | Bundled en/pl/de/es packs + remote pack sync. |
| `worker/` | Cloudflare Worker (`critterboard-api`), D1 schema, wrangler config. Deployed on its own, not bundled into the app. |
| `packs/` | Region-pack manifest + pack JSON, served from `raw.githubusercontent.com`. |
| `training/`, `tools/training-ui/` | Python pipelines for the vision model and persona LoRAs. |
| `website/` | Static landing page, served at critterboard.app by an assets-only Cloudflare Worker (see [[deployment]]). |
| `evals/` | Evalite chat evals. |

## Native surface (what forces a dev client)

These modules have native code, so the app **cannot run in Expo Go** and needs an EAS development build:

- `react-native-executorch` (vision; its podspec pins iOS **17.0**)
- `llama.rn` (on-device LLM; postinstall downloads `rnllama.xcframework`)
- `@maplibre/maplibre-react-native` (offline map)
- `expo-gl` + `three` (legacy Map globe, to be removed after the spike)
- `@sentry/react-native`, `expo-camera`, `expo-location`, `expo-notifications`, `expo-image-picker`, Reanimated/Worklets

## Network touchpoints

Everything below is optional. Without it the app degrades to bundled or mock behavior.

| Call | When | Source |
|---|---|---|
| Region pack + `.pte` model + species icon atlas ([[modules/species-icons]]) | User installs a pack; refreshed on boot (model only if its URL changed) | `packs/manifest.json` → GitHub raw / Releases |
| Translation packs | Boot, best-effort | `src/i18n/loader.ts` |
| Map pack (PMTiles) | Once, when the Map tab first opens (spike: `EXPO_PUBLIC_MAP_PACK_URL`) | `src/map/mapPack.ts` |
| Gemma 4 E2B GGUF (3.1 GB) | User turns on chat in Settings | Hugging Face (`unsloth/gemma-4-E2B-it-GGUF`) |
| Cloudflare Worker | `profile.networkOn` **and** `EXPO_PUBLIC_BACKEND_URL` set | `src/backend/cloudflare.ts` |
| Sentry | `profile.crashReportingOn` **and** DSN set | `src/lib/crashReporting.ts` |
