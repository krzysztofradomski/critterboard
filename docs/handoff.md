# Handoff — finishing the app on your Mac

`#handoff` `#runbook`

What to run locally to finish Critterboard, in order. Everything below assumes the latest `main`.

> Related: [[deployment]] (EAS / TestFlight details), [[modules/offline-map]], [[modules/species-icons]], [[modules/backend-adapter]], [[architecture]], `training/vision/README.md`, `tasks/todo.md` (full checklist).

## Where things stand

| Area | State on `main` | Needs you |
|---|---|---|
| Build | Typecheck + 294 tests pass; iOS/Android/web JS bundles build; `expo prebuild` works | First real Xcode build |
| Vision | 1,000-species model `eu-1k-commercial-v1` (pack `eu-ce` v5) live: 78.2% top-1 / 90.1% top-3 on held-out photos; licence-clean for commercial use; downloads on pack install | On-device check (load time, latency) |
| Species icons | Photo-based sticker icon for all 1,000 pack species (one 9.1 MB file, split on the phone; emoji fallback). Checked only in a headless browser | Phone check (§3) |
| Map | Offline MapLibre + PMTiles spike behind `USE_OFFLINE_MAP` (native); web still uses the globe | Make a map pack and look at it |
| Chat | Gemma 4 E2B (Apache 2.0) via `llama.rn`, 3.1 GB download from Settings. Without it chat is disabled (no scripted replies, no web chat); regex guardrails (ADR 005) | Download, speed and memory check (§3) |
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
| `EXPO_PUBLIC_SENTRY_DSN` | Opt-in crash reporting |

## 2. Simulator

```bash
pnpm ios:sim                 # expo run:ios — generates ios/, pod install, builds, launches, starts Metro
```

The first build takes a while (CocoaPods + MapLibre + ExecuTorch + llama.rn). After that, JS changes hot-reload. Re-run the command after changing `app.json`, plugins or native deps.

**Smoke test in the simulator:**

1. **Onboarding → Home** renders.
2. **Vision:** Settings → On-device Brains → Regional packs → install **Central Europe**. It downloads the pack JSON, the 88 MB model and the 9.1 MB icon file from GitHub. Afterwards the **Dex** shows sticker icons: caught species in colour, the rest as ink silhouettes. Then open Scan and use the **photo picker**, because the simulator has no camera. Try a photo of a peacock butterfly, a ladybird or a bumblebee; the result should name the species. If it falls back to mock or "no match", check the Metro log for ExecuTorch load errors.
3. **Map:** see §4.
4. **Chat:** before the model is downloaded, Chat shows a "Download Gemma 4 to chat" card instead of the input. Settings → On-device chat downloads it (3.1 GB). The simulator may be too slow to chat; the phone check below is the real test.
5. **No pack installed:** Scan shows an "install the Central Europe pack" card instead of results.

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
- Memory: nothing crashes when Gemma 4 loads in chat (it needs about 3 GB of RAM).

**Species icons (new in pack v5):**
- **First install:** after the model finishes, time how long until the Dex shows icons. The app downloads one 9.1 MB file and splits it into 1,000 small files; the split is the unknown. Under ~10 s is fine. If it's much slower, tell me and I'll batch it differently.
- **Update path:** if the phone already had pack v4, relaunch the app. It should fetch only the icon file, not the 88 MB model again (watch the network or the time it takes).
- **Dex scrolling:** scroll the full 1,000-species list quickly. Note any stutter or blank cells that fill in late.
- **Looks:** a caught species shows a coloured sticker; an uncaught one shows a grey silhouette. Open a species from the Dex: the result card shows the big icon.
- **Offline:** turn on flight mode and relaunch. Icons must still show, because they're stored on the phone.
- **Uninstall:** remove the pack in Settings. The Dex falls back to emoji and nothing crashes.
- **Credits:** Settings → Open source libraries → On-device models → "Species icons" opens the credits page.

**Chat (Gemma 4 E2B, new):**
- **Gate:** before downloading, open Chat. The input is replaced by a "Download Gemma 4 to chat" card that opens Settings.
- **Download:** Settings → On-device chat → on. On Wi-Fi, note how long the 3.1 GB download takes. The file comes from Hugging Face (`unsloth/gemma-4-E2B-it-GGUF`). If it fails straight away (an anonymous download refused), the gate shows an error. Tell me, and I'll host the file ourselves (GitHub Releases or R2).
- **Load and speed:** time from opening Chat to the input appearing (model load), then time to the first word of a reply and a rough words-per-second figure.
- **Memory:** chat for a few minutes, switch personas, go to Scan and back. Note any crash or the app restarting.
- **Memory tiers:** on a 6 GB+ iPhone, turning chat on downloads straight away. On a 4 GB iPhone (iPhone 12 or older non-Pro), it first asks "Download on a 4 GB phone?"; say yes and note whether chat works or the app closes. On a 3 GB phone, the toggle is disabled ("not supported") and Chat says it isn't available. If you can't test a phone in a tier, say so and I'll note it as untested.
- **Tone:** switch the app language to Polish, German and Spanish and send a message in each. Replies should come in that language, stay short and match the persona.
- **Turn off:** Settings → On-device chat → off → confirm. Chat shows the gate again and 3.1 GB is freed (Settings → General → iPhone Storage).

## 4. Offline map spike

```bash
tools/map/extract.sh --sizes 19.79,49.97,20.22,50.13        # size per zoom level (Kraków example)
tools/map/extract.sh europe -25,34,45,72 7      # → tools/map/out/europe.pmtiles (~56 MB)
python3 -m http.server 8787 --directory tools/map/out        # keep running
echo 'EXPO_PUBLIC_MAP_PACK_URL=http://localhost:8787/europe.pmtiles' >> .env
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
| 7 | ~~Commercial-clean vision model~~ | Done | `eu-1k-commercial-v1`, now used by the app; see its MODEL_CARD |
| 10 | ~~Dex: list all pack species~~ | Done | Virtualised grid over bundled + pack species; caught species first |
| 11 | ~~Photo-based species icons~~ | Done | Pack `eu-ce` v5; see [[modules/species-icons]] |
| 12 | Phone check: icon download/split time, Dex scrolling (§3) | You → me | If the split is slow, I'll batch it or ship per-species files |
| 13 | Gemma 4 chat on a phone: download, load time, speed, memory tiers, tone in 4 languages (§3) | You → me | If the download is refused, I'll host the GGUF; if 4 GB phones crash even after confirming, disable chat there too |
| 14 | Better icons for bumblebees and mining bees | Me | Weakest group: fuzzy outlines come out as blobs |
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
- **88 MB model download** on pack install, plus the 9.1 MB icon file. A static-int8 build (22.8 MB) did not load in the ExecuTorch runtime.
- **Icon split on the device** (1,000 small file writes) is untested on a phone; see §3.
- **Gemma 4 chat** needs a 3.1 GB download and about 3 GB of RAM. 4 GB phones must confirm first and may still close the app under memory pressure; below 4 GB chat is disabled (ADR 005). The file comes from a community Hugging Face repo; if that ever needs a login, host it ourselves. Licence: Apache 2.0.
- **Licence notices:** the model's Apache-2.0 notice and CC-BY photo credits (and the Gemma 4 chat model credit) are linked from Settings → Open source libraries → On-device models. Keep them there if you fork the app.
- **Guardrails are regex-only** since the Node-only library was removed. They are fine for obvious cases, not a full moderation system.
- **Licences:** the shipped model uses only CC0/CC-BY photos and Google's Apache-2.0 base weights. The residual risk is the base weights' ImageNet-21k pretraining; see `training/vision/results/commercial-1k-v1/MODEL_CARD.md`. The older v3 model (NonCommercial photos) is no longer referenced by the pack.
