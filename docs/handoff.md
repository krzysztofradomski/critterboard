# Handoff — finishing the app on your Mac

`#handoff` `#runbook`

What to run locally to finish Critterboard, in order. Everything below assumes the latest `main`.

> Related: [[deployment]] (EAS / TestFlight details), [[modules/offline-map]], [[modules/backend-adapter]], [[architecture]], `training/vision/README.md`, `tasks/todo.md` (full checklist).

## Where things stand

| Area | State on `main` | Needs you |
|---|---|---|
| Build | Typecheck + 336 tests pass; iOS/Android/web JS bundles build; `expo prebuild` works | First real Xcode build |
| Vision | 200-species model `eu-ce` v3 live: 83.7% top-1 / 94.0% top-3 on held-out photos; downloads on pack install | On-device check (load time, latency) |
| Map | Offline MapLibre + PMTiles spike behind `USE_OFFLINE_MAP` (native); web still uses the globe | Make a map pack and look at it |
| Chat | Regex guardrails on all platforms; Gemma 1B via `llama.rn`, Gemini POC if a key is set | Optional smoke test |
| Backend | Worker code ready, **not deployed**; app uses mock data until `EXPO_PUBLIC_BACKEND_URL` is set | Cloudflare account steps |
| Store | EAS profiles ready; `submit.production` placeholders unfilled | Apple / Play accounts |

---

## 0. One-time prerequisites

- macOS with **Xcode** (plus its command-line tools) and an iOS Simulator
- **CocoaPods**: `brew install cocoapods`
- **Node 22** and **pnpm 10.33**: `corepack enable && corepack prepare pnpm@10.33.0 --activate`
- For map packs: `brew install pmtiles`
- For Cloudflare: a Cloudflare account. `wrangler` comes with `worker/`'s dev dependencies.
- For a physical iPhone: your Apple ID signed into Xcode (Settings → Accounts)

## 1. Get the code running

```bash
git checkout main && git pull
pnpm install                 # also downloads llama.rn's iOS framework (postinstall)
cp .env.example .env         # fill in only what you need, see below
pnpm run check               # typecheck + tests, should be green
```

`.env` keys (all optional):

| Key | Effect when set |
|---|---|
| `EXPO_PUBLIC_MAP_PACK_URL` | App downloads that PMTiles map pack once (spike) |
| `EXPO_PUBLIC_BACKEND_URL` | Social features switch from mock data to your Worker |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Dev-only cloud fallback for chat/vision (key ships in the bundle, don't use for release) |
| `EXPO_PUBLIC_SENTRY_DSN` | Opt-in crash reporting |

## 2. Simulator

```bash
pnpm ios:sim                 # expo run:ios — generates ios/, pod install, builds, launches, starts Metro
```

The first build takes a while (CocoaPods + MapLibre + ExecuTorch + llama.rn). After that, JS changes hot-reload. Re-run the command after changing `app.json`, plugins or native deps.

**Smoke test in the simulator:**

1. **Onboarding → Home** renders.
2. **Vision:** Settings → On-device Brains → Regional packs → install **Central Europe**. It downloads the pack JSON and the 60 MB model from GitHub. Then open Scan and use the **photo picker**, because the simulator has no camera. Try a photo of a peacock butterfly, a ladybird or a bumblebee; the result should name the species. If it falls back to mock or "no match", check the Metro log for ExecuTorch load errors.
3. **Map:** see §4.
4. **Chat:** answers with the mock or Gemini adapter; on-device Gemma needs its model download from Settings.

The simulator's on-device ML may be slow or unsupported. Treat vision/LLM speed as phone-only measurements.

## 3. Physical iPhone

1. iPhone: **Settings → Privacy & Security → Developer Mode → On** (restarts the phone).
2. Plug it in by USB, then run:
   ```bash
   pnpm ios:device           # pick the phone from the list
   ```
3. **Signing:** Xcode signs with your Apple ID.
   - **Free Personal Team:** the build fails on the Push Notifications capability that `expo-notifications` adds. Open `ios/Critterboard.xcworkspace` → target → Signing & Capabilities → remove **Push Notifications**, then re-run. The app only schedules local notifications. Free-team installs expire after 7 days.
   - **Paid team ($99/yr):** no changes needed.
4. First launch: **Settings → General → VPN & Device Management → trust** your developer profile.

**On the phone, check and note down:**
- Time for the model download plus the first scan (cold load), then a second scan (warm).
- That a real camera shot of a common garden insect is identified.
- Memory: nothing crashes when the Gemma model loads in chat.

## 4. Offline map spike

```bash
tools/map/extract.sh --sizes 19.79,49.97,20.22,50.13        # size per zoom level (Kraków example)
tools/map/extract.sh krakow 19.79,49.97,20.22,50.13 14      # → tools/map/out/krakow.pmtiles
python3 -m http.server 8787 --directory tools/map/out        # keep running
echo 'EXPO_PUBLIC_MAP_PACK_URL=http://localhost:8787/krakow.pmtiles' >> .env
pnpm ios:sim
```

- Open the **Map** tab. The app downloads the pack once, then renders the sticker-style map.
- Stop the server and relaunch: the map must still render, since it's offline after the download.
- On a phone, use your Mac's LAN IP instead of `localhost`.
- If it renders nothing: MapLibre may not accept the `pmtiles://file://…` URL on iOS. That's the spike's main risk. Tell me and I'll switch to a fallback. To get the globe back immediately, set `USE_OFFLINE_MAP = false` in `src/screens/Map.tsx`.

**Send back:** a screenshot and the `--sizes` output. Those decide the zoom levels for region packs.

## 5. Cloudflare backend

The code is ready; the account resources aren't. From `worker/`:

```bash
cd worker && npm ci
npx wrangler login
npx wrangler d1 create critterboard              # copy database_id
npx wrangler kv namespace create LEADERBOARD     # copy id
```

Edit `worker/wrangler.toml` **before the first deploy**:

- Paste the real `database_id` and KV `id`.
- Change `new_classes = ["FeedInbox"]` to **`new_sqlite_classes = ["FeedInbox"]`**. The free plan only supports SQLite-backed Durable Objects, and this can't be changed after the first deploy.
- Bump `compatibility_date` to today.
- Optionally add `[observability]` with `enabled = true` for logs.

Then:

```bash
npx wrangler d1 execute critterboard --remote --file=schema.sql
openssl rand -base64 48 | npx wrangler secret put JWT_SECRET
npx wrangler deploy                                # prints https://critterboard-api.<you>.workers.dev
```

Point the app at it:

- Local: set `EXPO_PUBLIC_BACKEND_URL=https://critterboard-api.<you>.workers.dev` in `.env`.
- Store builds: `pnpm exec eas env:create --name EXPO_PUBLIC_BACKEND_URL --value <url> --environment production --visibility plaintext` (repeat for `preview`).
- Optional: a custom domain `api.critterboard.app`. Move the domain's DNS to Cloudflare, then add a route with `custom_domain = true`.

Test: in the app, Settings → turn **Network** on. Leaderboard, Friends and Activity should now show real (initially empty) data instead of the mock seeds.

## 6. TestFlight / Play (when ready)

Full detail in [[deployment]]. Short version:

```bash
pnpm exec eas login
pnpm exec eas device:create          # only for ad-hoc/dev builds on your phone
# fill eas.json → submit.production: appleId, ascAppId, appleTeamId
pnpm run build:ios && pnpm run submit:ios
```

Needs the Apple Developer Program, and the app record created in App Store Connect.

## 7. What's left, and who does it

| # | Task | Who | Notes |
|---|---|---|---|
| 1 | First Xcode build + smoke test (§2–3) | You | Report any native build error with the full log |
| 2 | On-device model check: load time, scan latency | You | If too slow/big: int8 QAT or a smaller backbone |
| 3 | Map spike verdict + sizes (§4) | You → me | Then I wire map packs into region packs, host on R2, remove the globe |
| 4 | Cloudflare deploy (§5) | You | Account/DNS steps can't be done from the cloud sandbox |
| 5 | Pack & model hosting on R2 (instead of GitHub raw) | Me, after 4 | Needs an R2 bucket and an API token |
| 6 | Translate 180 new species (pl/de/es) | Me or you | They fall back to English today; I couldn't reach a name source |
| 7 | Commercial-clean vision model | Me, if needed | Retrain on CC0/CC-BY/CC-BY-SA photos only; 86% of today's photos are NonCommercial |
| 8 | `react-native-executorch` 0.10 migration | Me | 0.10 rewrote the API; pinned to 0.9.3 until then |
| 9 | Fill `eas.json` submit config, store listings | You | Needs your Apple / Google accounts |

## 8. Retraining the vision model (optional)

Full pipeline and design notes are in `training/vision/README.md`. On a Mac:

```bash
python3 -m venv ~/mlenv && ~/mlenv/bin/pip install "executorch==1.0.1" timm pillow numpy
export DATA=~/vdata PATH=~/mlenv/bin:$PATH
training/vision/stream_obs.sh && python training/vision/select_species.py --data $DATA --top 200
training/vision/stream_photos.sh && python training/vision/download.py --data $DATA
```

`train.py` is written for x86 CPUs with bf16 (it took ~3.5 h on 4 cores with AMX). On an Apple-silicon Mac it will run but slowly on CPU. A GPU box, or adding MPS support to `train.py`, is the faster route.

## Known risks

- **Model not yet loaded on a device.** The exporter (`executorch` 1.0.1) was chosen to match the app's ET12 runtime, and all operators are supported kernels, but only a phone run proves it.
- **60 MB model download** on pack install; static int8 (15.6 MB) lost 9 points of accuracy.
- **Guardrails are regex-only** since the Node-only library was removed. They are fine for obvious cases, not a full moderation system.
- **Licences:** 86% of the training photos carry a NonCommercial licence (CC-BY-NC, -NC-SA, -NC-ND). Keep the model to free/non-commercial use unless retrained (see task 7).
