# Critterboard — master task tracker

Living checklist of what's shipped and what's left. Treat this as the source of truth for project status; commit changes here in the same commit that lands the work.

`#tasks` `#roadmap`

> See also: [[docs/ml-roadmap]] (on-device ML), [[docs/architecture]] (system overview), [[tasks/archive]] (past plans).

---

> Local runbook for everything below: [[docs/handoff]].

## Now — Licensing and pipeline audit

Findings from the audit of the committed model and training pipeline. The model host is still undecided (user is thinking), so `eu-1k-commercial-v1.pte` stays in git for now.

- [x] Split by photographer across all species: `training/vision/splits.py`, used by `select_commercial.py` and `select_species.py` (`--test-frac` / `--val-frac` replace `--test` / `--val`); checked on synthetic data: no photographer in two splits
- [x] Delete `packs/models/eu-ce-v3.pte` (trained on NC/ND/SA photos + ImageNet-1k weights); run reports kept, marked not licensed for reuse
- [x] `LICENSE` (MIT, code only), `NOTICE.md` (model, photo, icon and chat-model terms), `license` in `package.json`, README wording
- [x] Model card and vision README: per-species split disclosed, test score called slightly optimistic
- [x] `training/vision/requirements.txt` (executorch 1.0.1 pinned; other versions of the shipped run were not recorded)
- [ ] Retrain `eu-1k-commercial-v1` on the photographer-grouped split (~9.5 h on 4 CPUs) and re-measure the `.pte`; save `pip freeze` with the run
- [ ] Decide where the model lives (R2 / Releases / Hugging Face / stays in git). `packs/eu-ce.json` `modelUrl` points at `raw.githubusercontent.com/.../main/`, so the app needs the repo public. Then `.gitignore` `*.pte`, bump the pack version
- [ ] Decide the weights' own licence (see `NOTICE.md`); lawyer review before commercial launch
- [ ] Old `eu-ce-v3.pte` is still in git history; rewrite history or start a clean public repo if the repo goes public

---

## Now — Chat: Gemma 4 E2B only

Decision (user): use Gemma 4 for all cases; disable chat when it isn't installed. See [[docs/decisions/005-gemma-4-only-chat]].

- [x] Compare Gemma 4 E2B with Granite 4.0 H 1B/7B-A1B, SmolLM3 3B, DavidAU Qwen3 4×0.6B, BitCPM4 8B and LFM2.5 1.2B. Gemma 4 E2B wins on licence (Apache 2.0) and languages (Polish).
- [x] `src/ai/chatModel.ts`: download (resumable, non-2xx = error), load, delete, cleanup of the old Gemma 3 file; `useChatModel` hook
- [x] `llm.ts`: chat messages through the GGUF's template (jinja, thinking off), reply language, last 8 turns normalised; mock runtime removed
- [x] Chat gated: "Download Gemma 4" card instead of the input; web says "phone app only"; scripted replies, `chat.ts`, `webNativeLlm.ts` and the `localLlmOn` flag removed
- [x] Settings: model tile + toggle on the shared state; turning off confirms and deletes 3.1 GB; Gemma 4 credit (Apache 2.0)
- [x] Strings in en/pl/de/es; tests for the message builder and the model lifecycle
- [x] Memory tiers via `expo-device`: ≥ 6 GB class downloads directly, 4 GB class confirms first, smaller phones can't chat
- [x] Chat header: icon-only clear button, one-line name and status (was wrapping "Prof. Larva" over three lines)
- [ ] Phone check: download without a login, load time, speed, memory tiers (6 GB / 4 GB / 3 GB iPhones), tone in 4 languages ([[docs/handoff]] §3)

## Now — Remove cloud Gemini; photo-based species icons

Decisions (user): remove Gemini entirely (chat = on-device Gemma or scripted replies; Scan without a pack shows "install the pack", no mock results on phones). Icons: sticker style made from a real CC0 photo (cut-out, flat cartoon colours, ink lines, cream border, hard shadow), delivered with the species pack, emoji fallback.

- [x] Remove `geminiVision`, the tool chat adapter, chat tools, evals, and the `ai` / `@ai-sdk/google` / `zod` / `evalite` / `autoevals` deps; ADR [[docs/decisions/004-remove-cloud-gemini]]
- [x] Chat: `local` (Gemma / Chrome built-in) or `offline` (scripted); offline hint in 4 languages
- [x] Scan: "install the pack" card when no pack is installed on a phone; toast if the model is still loading; mock classifier only on web
- [x] `make_icons.py`: pick a photo per species with the trained model; attention heat map finds the insect, SAM cuts it out (a salient-object cutter kept flowers/leaves in ~25% of icons); cartoon + sticker frame
- [x] App: `bugIcons.ts` (download atlas, split into per-species files, `.v<version>` marker, registry), `BugIcon` (emoji fallback, Dex silhouette for uncaught) in Dex, Home, Result, Disambiguate, Map, Activity, region detail, profiles
- [x] Pack updates skip the ~90 MB model when its URL is unchanged
- [x] `build_icon_atlas.py`: atlas + pack `icons` block + manifest bump + `packs/icons/CREDITS.md`; docs [[docs/modules/species-icons]]
- [x] Generate 1,000 icons (~20 s each on 4 CPUs), review contact sheets, re-pick bad ones (148 rejected, 3 rounds); all CC0
- [x] Build atlas → pack `eu-ce` v5 (icons v1, 9.1 MB atlas, model unchanged), `packs/icons/CREDITS.md`, Settings credit link
- [ ] Check on a phone: first-install icon download + split time, Dex scrolling with 1,000 image cells

## Now — Vision v4: 1,000 species, commercial model first

Why: 200 species cover only 42.9% of European research-grade observations; 1,000 cover 74.5% (500: 60.6%, 2,000: 86.0%).

Decisions (user): base = **Google ViT-S/16 AugReg** (Apache 2.0 from Google, no NC restriction; residual ImageNet-21k provenance risk). The v3 base ConvNeXt-nano `d1h_in1k` fails: timm's author says to assume ImageNet's non-commercial terms apply. Photos = **CC0 + CC-BY only** (no NC / ND / SA). Commercial model first, then the non-commercial retrain.

- [x] Rank 1,500 candidate species; stream CC0/CC-BY first photos for their European observations (1.6M candidates; the stream was cut at 96.9% of the photos dump by a container restart, and only the newest uploads were missed)
- [x] Sample: first 1,000 species with ≥100 usable photos (only 6 of the top 1,000 skipped); ≤250/species, ≤3 per photographer → 243,202 photos, observer-grouped split
- [x] Download at 224 px (5.7 GB, 0 failures)
- [x] `train.py` made resumable (checkpoint every 400 steps); ViT-S/16 trained 5 epochs, ~9.5 h, no restarts
- [x] Export + verify: **78.2% top-1 / 90.1% top-3** on 25,338 test photos (`.pte`, 224 px), 88.4 MB. Static int8 (22.8 MB) failed to load in the runtime, so fp32 ships
- [x] `credits.csv.gz` (5,551 photographers), `MODEL_CARD.md` with licence obligations and risks → `training/vision/results/commercial-1k-v1/`
- [x] ~~Non-commercial retrain~~ → decided: the app uses the commercial model too (one model, clean licensing)
- [x] Pack `eu-ce` v4: 1,000 species, model `eu-1k-commercial-v1`; 736 English names (established UK/EU names), 264 Latin-only; new **epic** tier (<5k observations); all 200 v3 ids kept; manifest v4; region metadata 1,000 species / 89 MB
- [x] Licence notices in-app: Settings → Open source libraries → Vision model (model card, ATTRIBUTION.md with 5,551 photographers, Apache 2.0 text)
- [x] Dex lists every known species (bundled + pack) in a virtualised 2-column `FlatList`; caught first; counts only listed species. Checked in headless Chromium with the v4 pack seeded: "7 of 1000 caught", scrolling, `?512` search, no console errors
- [x] Pack species everywhere: chat tools (`getInsectInfo` / `getAvailableImages` capped at 25, caught first; `epic` rarity filter; totals incl. packs), `Chat.tsx` total, `maxXp()` (was a module-load constant), dex exports
- [ ] pl/de/es names for the 980 pack species (fall back to English/Latin today)

## Now — Vision v3: 200 European species, fast on-device model

Goal: a fast classifier for the ~200 most-observed European insects (and spiders), shipped as region pack `eu-ce` v3.

Constraints found: cloud sandbox has 4 CPUs, no GPU. iNaturalist API, Hugging Face and download.pytorch.org are blocked by egress policy. Available: iNaturalist AWS Open Data bucket (metadata dumps + photos), timm weights on GitHub releases, PyPI.

- [x] Data: stream `taxa` + `observations` dumps → 12.4M European research-grade Insecta/Arachnida observations → top 200 species (+ the 20 current ones)
- [x] Data: stream `photos` dump → first photo per observation, ≤3 observations per observer per species, observer-grouped train/val/test split
- [x] Data: download 79,987 photos (≈240 img/s with a pooled HTTP client), resize to 256 px; licences in `images/manifest.csv`
- [x] Base model: pilots on this CPU → ConvNeXt-nano (50.0%) over ViT-S in21k (47.2%) and ViT-Ti in21k (38.2%); depthwise-heavy EfficientNets were too slow to train here (no AMX benefit)
- [x] Train: 6 epochs, 160→192 px, ~3.5 h → test 80.9% top-1 at 192 px
- [x] Export: `executorch==1.0.1` + XNNPACK; the `.pte` scores **83.7% top-1 / 94.0% top-3 at 224 px** on all 8,085 test photos; fp32 60.4 MB (static int8 lost 9 points, rejected)
- [x] Pack v3: `packs/eu-ce.json` (200 bugs, labelMap), `packs/models/eu-ce-v3.pte`, manifest v3, region metadata + strings
- [x] App: labels map through pack species (`findBugByLatin`); `bugName` falls back to the pack name
- [x] Docs: `training/vision/README.md`, `docs/ml-roadmap.md`
- [ ] Translate the 180 new species names (pl/de/es fall back to English); no name source was reachable from the sandbox
- [ ] Follow-up: on-device latency check on an iPhone; consider smaller model (int8 QAT or a LayerNorm-free backbone) if 60 MB is too big

#### Review — vision v3
- `pnpm run check` ✅ 21 files / 336 tests (new: pack integrity, pack-species lookup + name fallback) · iOS bundle ✅
- Accuracy is measured on the exported `.pte` itself (the ExecuTorch runtime on host), not only on the PyTorch model; at 192 px it matched PyTorch exactly (80.85%)
- Not verified here: on-device load and latency in react-native-executorch 0.9.3. The exporter was picked to match its ET12 / 1.0-era runtime, and the ops used are in its kernel set (XNNPACK, dim_order ops)

## Next — iOS device testing, Leaflet map, Cloudflare setup (plan, awaiting go-ahead)

App map written to [[docs/architecture]].

### A. Test the iOS build on a physical iPhone
- [ ] Apple Developer Program membership active (required for any device install)
- [ ] iPhone: Settings → Privacy & Security → Developer Mode on (needed for ad-hoc/dev builds on iOS 16+)
- [ ] `pnpm exec eas device:create` → register the iPhone UDID
- [ ] Rebuild `pnpm run build:dev-ios` (regenerates the profile with the UDID and bakes in the `critterboard://` scheme)
- [ ] `pnpm run start:dev` (add `--tunnel` if phone and laptop aren't on the same Wi-Fi)
- [ ] Bump `expo` to `^57.0.9` + `npx expo install --fix` (expo-doctor: Hermes V1 memory regression in 57.0.4 / RN 0.86.0)
- [ ] Optional TestFlight path: fill `submit.production` in `eas.json`, create the App Store Connect record
- [x] Docs: swap deprecated `eas secret:create` for `eas env:create` in `docs/deployment.md`

### B. Replace the cartoon globe with an offline MapLibre + PMTiles map
Decision: fully offline vector map. One-time download of a regional PMTiles extract, drawn with a bundled "sticker" MapLibre style. Chosen over Leaflet, which would need a WebView and awkward local-file reads.

**Step 0: dependency refresh (before the spike)**
- [x] Expo SDK 57 latest patch (`expo@57.0.25`) + `expo install --fix` → RN 0.86.3 (fixes the Hermes V1 memory regression expo-doctor flagged)
- [x] Non-SDK packages to latest stable: ai 7.0.114, @ai-sdk/google 4.0.80, zod 4.6.5, zustand 5.0.15, llama.rn 0.12.9, three 0.186, eas-cli 24.8, TypeScript 7.0.2, Vitest 5.0.2
- [x] TypeScript 7: dropped removed `baseUrl` / `ignoreDeprecations` from `tsconfig.json` + `evals/tsconfig.json` (paths now `./src/*`)
- [x] Worker: wrangler 4.141, workers-types 5.x, TypeScript 7
- [x] **BLOCKER (already on main), fixed:** iOS/Android JS bundle failed because `src/ai/guardrails.ts` imported the Node-only `@presidio-dev/hai-guardrails`. Ported its guards to regex (secrets, prompt leakage, input PII redaction) in `guardrailsCore.ts`. One `guardrails.ts` for all platforms; dependency removed.
- [x] Local build scripts: `pnpm ios:sim`, `pnpm ios:device` (`expo run:ios`, no EAS)
- [ ] Follow-up: migrate to `react-native-executorch` 0.10 (full API rewrite: `useClassifier`/`createClassifier`, image buffers instead of URIs, new resource fetcher). Pinned to 0.9.3 (`legacy` tag) until then.

Deliberately held back: Babel 8 (`babel-preset-expo` is on Babel 7), SDK-pinned majors (RN 0.87, Reanimated 4.7, gesture-handler 3, Sentry 8, async-storage 3 are not in the SDK 57 map), llama.rn 0.13 (RC only), ExecuTorch 0.10 (see above).

#### Review — Step 0
- `pnpm run typecheck` ✅ · `pnpm test` ✅ 18 files / 304 tests (Vitest 5) · `expo install --check` ✅ · worker `tsc` ✅ + `wrangler deploy --dry-run` ✅
- expo-doctor: Hermes check now passes. Remaining ✖: two checks that need network (schema, RN Directory) + "eas-cli installed locally" (kept on purpose; scripts call the local `eas` binary)
- `expo prebuild` (iOS + Android) ✅, Podfile at iOS 17.0, `critterboard://` scheme present · `expo export --platform web` ✅
- `expo export --platform ios|android` initially ❌ `Unable to resolve module node:module` from `@presidio-dev/hai-guardrails` (also on unmodified `main`: every dev-client launch would red-screen). After the regex port: iOS ✅ 2104 modules, Android ✅ 2105 modules. Tests 322/322 (engine tests replaced by regex equivalents + false-positive cases). Dropped: the engine's numeric heuristic thresholds only.
- Pre-existing, not in `check`: `tsc -p evals/tsconfig.json` has 29 evalite typing errors, same count before and after.

**Spike: offline map renders on device**
- [x] Add `@maplibre/maplibre-react-native` 11.4 + Expo config plugin (web keeps the globe for now)
- [x] Sticker style in TS (`src/map/stickerStyle.ts`) from `pb.ts` colours; no glyphs/sprites; validated by `validateStyleMin` in tests
- [x] `OfflineMap` component (drop-in for the globe, same props + `flyTo`); download-once pack helper (`src/map/mapPack.ts`, `.part` + rename)
- [x] `altitudeToZoom` so the existing framing logic drives the 2D camera; `USE_OFFLINE_MAP` flag in `Map.tsx`
- [x] `tools/map/extract.sh` (+ `--sizes` estimate) and `tools/map/README.md`
- [ ] **You, on the Mac:** cut a pack, serve it, `pnpm ios:sim`, check the map renders, then kill the server and confirm it still renders (airplane mode)
- [ ] Record real pack sizes per zoom (`extract.sh --sizes`)
- [ ] Same on a physical iPhone (`pnpm ios:device`)

#### Review — spike
- `pnpm run typecheck` ✅ · `pnpm test` ✅ 19 files / 329 tests (new: style validity/offline-ness, zoom conversion)
- `expo prebuild` ✅ (MapLibre plugin writes its Podfile hook) · `expo export` iOS ✅ 2181 modules, Android ✅ 2182, web ✅
- Not verifiable here: native rendering, `pmtiles://file://` loading on iOS, look and feel, sizes (Protomaps builds unreachable from the cloud sandbox)
- Docs: `docs/modules/offline-map.md`, ADR `docs/decisions/003-offline-map-maplibre-pmtiles.md`, index + architecture updated

**After the spike**
- [ ] Add `mapUrl` / `mapVersion` to region packs; download with the species + model pack
- [ ] Optional "save my area" high-zoom download (`OfflineManager.createPack` or a second extract)
- [ ] Remove `react-cartoon-planet`, `three`, `@types/three`, `expo-gl`, the `.geojson` Metro ext, `CartoonPlanetGlobe.*`, `Map.web.tsx`
- [ ] "© OpenStreetMap contributors" on the map + in `CreditsDialog`
- [ ] Docs: `docs/modules/offline-map.md` + ADR 003

### C. Cloudflare setup
- [ ] `wrangler d1 create` / `kv namespace create` → replace placeholder IDs in `worker/wrangler.toml`; apply `schema.sql` remotely
- [ ] Durable Object migration `new_classes` → `new_sqlite_classes` (free plan; must happen before first deploy)
- [ ] `wrangler secret put JWT_SECRET`; bump `compatibility_date`; enable `[observability]`
- [ ] Custom domain `api.critterboard.app` (move DNS for `critterboard.app` to Cloudflare)
- [ ] Set `EXPO_PUBLIC_BACKEND_URL` via `eas env:create` for preview/production + local `.env`
- [ ] Optional: landing page Netlify → Workers static assets; packs/model → R2; GitHub Action deploy with `CLOUDFLARE_API_TOKEN`

---

## Current Review — local-device readiness inspection

- [x] Map project structure, config, native settings, and dependencies
- [x] Inspect runtime code for likely physical-device issues
- [x] Run available verification commands
- [x] Summarize prioritized findings, gaps, and suggested fixes

## Current Fix — local-device readiness follow-up

- [x] Add regression tests for scan fallback and scan-cache coordinate preservation
- [x] Fix scan fallback so unloaded ExecuTorch falls through to Gemini/mock, not the native placeholder
- [x] Fix `check` to use pnpm and remove the missing lint hop until lint exists
- [x] Add an EAS development profile that can install on physical iOS devices
- [x] Preserve GPS pins when clearing cached scan photos
- [x] Align remaining package versions with Expo's local dependency map
- [x] Run typecheck, tests, and Expo dependency check

### Review

- `package.json` / `pnpm-lock.yaml`: standardized on pnpm, removed the stale npm lockfile, added direct `zod`, aligned Expo SDK 57 dependencies with `expo install --check`, and pinned Babel / TypeScript back to compatible majors after TS 7 broke the existing config.
- `src/ai/scanClassifier.ts` + `Scan.tsx`: Scan now uses ExecuTorch only when the hook is ready; otherwise it calls the Gemini/mock fallback. Regression covered by `scanClassifier.test.ts`.
- `src/store/useAppStore.ts`: `clearScanCache()` now removes `photoUri` while preserving any `lat/lng` fields, so clearing photos does not erase map pins. Regression covered in `useAppStore.test.ts`.
- `eas.json` + `docs/deployment.md`: added `development-device` for physical-device dev clients and documented the pnpm/EAS commands.
- React Native 0.86 type update: replaced `StyleSheet.absoluteFillObject` with `StyleSheet.absoluteFill` across screens/components.
- AI SDK / Vitest type cleanup: adjusted tool-test options, `globalThis.fetch`, and the settings-tool patch type for the newer dependency set.

Verification:

- `pnpm run typecheck` passes.
- `pnpm test` passes: 18 files, 304 tests.
- `pnpm run check` passes.
- `pnpm exec expo install --check` passes using Expo's local dependency map.

## Current Removal — retired prototype

- [x] Remove retired screen and route registration
- [x] Remove recording permissions from native config
- [x] Remove retired translation keys from bundled language packs
- [x] Remove deferred roadmap/task references
- [x] Verify no retired-feature references remain and run checks

### Review

- Removed the unused UI surface from navigation and deleted the screen implementation.
- Removed native recording permissions from `app.json`; the app no longer requests that device capability.
- Removed the bundled translation block and deferred implementation plan so this is no longer presented as future work.
- Verification: retired-feature reference sweep is clean; `pnpm run typecheck`, `pnpm test`, `pnpm run check`, and `pnpm exec expo install --check` all pass.

## Current Fix — Expo Go device incompatibility

- [x] Diagnose SDK/runtime mismatch behind the iPhone Expo Go error
- [x] Add the SDK-matched development-client dependency
- [x] Add explicit `start:dev` and `start:go` scripts
- [x] Document the physical-device dev-client path
- [x] Verify dependency alignment, typecheck, and tests

### Review

- Root cause: the project is on Expo SDK 57, while Expo Go is a fixed native app and can only run SDKs bundled into the installed Expo Go binary. A latest-from-App-Store install can still be unusable for this project if it does not contain SDK 57 for that device/OS.
- Added `expo-dev-client@~57.0.5`, matching Expo's local SDK 57 dependency map.
- `pnpm run start:dev` now starts Metro for the dev client; `pnpm run start:go` is explicit and unsupported for normal physical-device testing.
- Build and submit scripts call the actual `eas` binary exposed by `eas-cli`; `pnpm exec eas --version` and EAS help commands resolve locally.
- `docs/deployment.md` now points iPhone testing at `pnpm run build:dev-device` followed by `pnpm run start:dev`.
- Verification exposed TypeScript 6 side-effect import checks; added the TS 6 deprecation guard and narrow declarations for the platform initializer / CSS side-effect imports.
- The guardrails unit test now mocks the vendor worker package at the module boundary, so `pnpm test` no longer trips over the package's baked-in Piscina worker path.
- Verification: `pnpm exec expo install --check`, `pnpm run typecheck`, `pnpm test`, and `pnpm run check` pass.

## Current Fix — EAS iOS deployment target

- [x] Diagnose EAS native prebuild failure from too-low iOS deployment target
- [x] Add SDK-matched `expo-build-properties`
- [x] Decode the failed EAS build log and identify the exact pod requirement
- [x] Pin iOS deployment target to `17.0` in managed config
- [x] Remove invalid-looking camera microphone plugin config while keeping Android audio recording disabled
- [x] Block `expo-image-picker` from re-adding Android audio recording permission
- [x] Add Reanimated's required `react-native-worklets@0.10.x` peer for development-client runtime builds
- [x] Clean Expo dependency hygiene surfaced by EAS Doctor / pnpm peer checks
- [x] Document the native build-property requirement
- [x] Verify Expo config, dependency alignment, typecheck, and tests

### Review

- EAS uploaded the project and failed during iOS native dependency installation because some pods require a higher minimum deployment target.
- The failing pod is `react-native-executorch`; its podspec declares iOS `17.0`, so the managed prebuild now sets `ios.deploymentTarget` to `17.0` via `expo-build-properties`.
- The Expo Camera plugin keeps Android audio recording disabled with `recordAudioAndroid: false`. The stale camera `microphonePermission: false` value was removed because the app no longer needs an iOS microphone usage string.
- `expo-image-picker` explicitly sets `microphonePermission: false`; without that, its config plugin re-adds Android audio recording permission for video capture defaults.
- Added `react-native-worklets@0.10.0` to satisfy the `react-native-reanimated@4.5.0` peer dependency that EAS Doctor flagged as a dev-client crash risk.
- Removed direct `expo-modules-core`; Expo owns it transitively. Added `@expo/dom-webview@57.0.0` to match Expo 57's log-box peer graph.
- Verification: `pnpm exec expo config --type prebuild --json` shows the build-properties plugin config; `pnpm exec expo install --check`, `pnpm run typecheck`, `pnpm test`, and `pnpm run check` pass.

## Current Fix — llama.rn native artifact install

- [x] Diagnose Xcode failure for missing `rnllama` header
- [x] Inspect `llama.rn` podspec and postinstall artifact flow
- [x] Allow the `llama.rn` postinstall script through pnpm's build-script allowlist
- [x] Verify native artifacts install locally and project checks

### Review

- EAS reached Xcode and failed with a missing `rnllama` header.
- `llama.rn` publishes without `ios/rnllama.xcframework` in the npm tarball; its postinstall script downloads that framework from the package's GitHub release.
- pnpm had been ignoring `llama.rn` build scripts during install, so EAS received the source package without the native framework headers expected by the podspec.
- `package.json` now declares `pnpm.onlyBuiltDependencies: ["llama.rn"]` so cloud installs run only this required dependency script.
- Verification: `pnpm rebuild llama.rn` downloaded `ios/rnllama.xcframework`; the framework contains `Headers/rn-llama.h`; `pnpm exec expo install --check`, `pnpm run typecheck`, and `pnpm test` pass.

## Current Fix — dev-client launch on iPhone

- [x] Diagnose installed dev-client integrity warning and unusable QR report
- [x] Add a native URL scheme for dev-client deep links
- [x] Document iOS ad-hoc device registration and QR scanner flow
- [x] Verify Expo config and project checks

### Review

- The app installed but iOS refused to open it with an integrity warning. For EAS internal/ad-hoc iOS builds, the most likely cause is that the iPhone's UDID is not included in the provisioning profile used for that build, or the profile/certificate is stale.
- The terminal QR also reported "no usable data"; the app did not declare a stable native URL scheme, so dev-client deep links had no app-specific route.
- `app.json` now declares `scheme: "critterboard"`. This is native config and requires one more dev-client rebuild before QR/deep links can use it.
- Verification: `pnpm exec expo config --type prebuild --json` shows `scheme: "critterboard"`; `pnpm run typecheck` and `pnpm test` pass.

### Review

Findings from the local-device readiness pass:

- Expo dependency set is internally inconsistent. `expo@56` expects React 19.2.3 / React Native 0.85.3 and matching Expo module versions, but `package.json` pins React 18.3.1 / React Native 0.76.5 plus older camera, picker, location, notifications, Reanimated, screens, safe-area, SVG, and web packages. `pnpm exec expo install --check` fails.
- Scan fallback is not wired as described. `USE_NATIVE_VISION = true` makes the global `vision` singleton the placeholder `nativeClassifier`; if the ExecuTorch hook is not ready, Scan calls that placeholder and drops to No Match.
- `npm run check` is broken because it references a missing `lint` script. `pnpm run check` still fails because the script shells out to `npm`.
- `npm run test` fails with the guardrails/Piscina worker path issue, while `pnpm test` passes. The repo should standardize on pnpm and remove the stale npm lockfile or make npm unsupported explicit.
- The EAS development iOS profile builds simulator-only (`ios.simulator: true`), so it cannot install on a physical iPhone. Use preview or add a physical-device dev profile.
- Re-catching an already-known species from Result does not create a catch event, map pin, quest progress, streak progress, or backend publish. This is only OK if "catch" means first dex unlock, not every real sighting.
- Clearing scan cache strips whole catch events down to `{ id, at }`, which also erases GPS pins for photo-backed catches.

Verification:

- `pnpm run typecheck` passes.
- `pnpm test` passes: 17 files, 301 tests.
- `pnpm exec expo install --check` fails with expected-version mismatches.
- `npm run test` fails with the guardrails/Piscina worker path error.
- `npm run check` / `pnpm run check` fail due to missing `lint` script.

Docs: no `docs/` update needed; this review did not change architecture or app behavior.

---

## Done

### Mobile-Safari camera unblock

Fixed a soft-brick on the Permissions screen for mobile-Safari (and any non-secure-context web) users: tapping "Allow" silently failed because `navigator.mediaDevices` is undefined over HTTP, but the camera was marked `required` so the Continue button stayed disabled with no explanation.

- [x] `Permissions.tsx` — camera is now `recommended` (not `required`) on web; user can tap "Not now" and proceed
- [x] Web-only pre-flight (`diagnoseWebCameraAvailability`) distinguishes HTTPS-missing from API-missing and shows an actionable toast
- [x] Native (iOS/Android) gate unchanged: camera is still required, "Not now" still disabled
- [x] Two new i18n keys (`permissions.cameraUnavailableWeb`, `permissions.cameraNeedsHttps`) in en/pl/de/es
- [x] `docs/modules/permissions-web.md` + index update explains the rationale and Safari constraints
- [x] `npx tsc --noEmit` clean

#### Review

- Worst-case web flow is now "snap" → "use the photo picker" instead of "dead button", because `expo-image-picker` on web is a `<input type="file">` and needs no runtime permission.
- The classifier and the rest of the app already accept a `null` photo URI, so no downstream changes were needed.
- The Sticker pill on the camera card now reads "RECOMMENDED" on web, which also doubles as a hint to the user that they can proceed without granting.

### Responsive shell for larger screens

Prevented desktop/tablet stretch by constraining the whole app to a centered mobile viewport. This applies once in `App.tsx`, so every route inherits the same max-width behavior.

- [x] Added global shell + centered `maxWidth` app frame in `App.tsx`
- [x] Preserved existing screen internals (no per-screen layout forks)
- [x] Updated docs index + module note for future contributors
- [x] Run `npm run typecheck` after this batch

#### Review

- The fix is intentionally global and low-risk: all existing absolute-positioned UI and tab bars now anchor to a stable app frame on larger displays.
- Mobile behavior is unchanged because devices under `520px` still use full width.

### Backend adapter seam (mock today, Cloudflare tomorrow)

Single seam between the UI and any out-of-process service. Mock implementation resolves today; the Cloudflare Workers impl is a stub behind one flag. Leaderboard / friend graph / suggested feed all read through the seam.

- [x] `src/backend/types.ts` — schemas (`BackendUser`, `LeaderboardEntry`, `FriendNode`, `FeedEvent`, page envelopes, `BackendError`)
- [x] `src/backend/adapter.ts` — `BackendAdapter` interface (`identity / syncProfile / publishCatch / fetchLeaderboard / fetchFriends / fetchFeed / follow / unfollow / ready`)
- [x] `src/backend/mock.ts` — default impl, synthesizes from `LEADERS` + `FRIENDS` + deterministic peer-activity ticker. Identity via `bindMockIdentity`
- [x] `src/backend/cloudflare.ts` — placeholder, throws `BackendError('unavailable')` everywhere
- [x] `src/backend/index.ts` — switchboard with `USE_REMOTE_BACKEND` flag
- [x] `src/backend/hooks.ts` — `useLeaderboard / useFriends / useFeed / useToggleFollow / usePublishCatch / useBackendIdentityBridge` with network gating + offline error state
- [x] `backendUserId` slice in `useAppStore` (lazy UUID v4, persisted, rotated on `wipeAll`, backfilled for legacy profiles)
- [x] `App.tsx` mounts `useBackendIdentityBridge` so the mock sees fresh xp/followed on every adapter call
- [x] `Leaderboard.tsx` reads `useLeaderboard(scope)` (with the prior in-screen synthesis kept as an offline fallback)
- [x] `Friends.tsx` reads `useFriends(scope)` + `useToggleFollow`; suggestion reasons render via the existing `person.why.*` keys
- [x] `Activity.tsx` grows a 4th tab — "Friends" — fed by `useFeed()`, with a dedicated offline empty state
- [x] i18n: `activity.tab.friends` + `activity.kind.friend{Catch,Streak,Badge,RankUp,Follow}*` + `friendCta` + `feedOffline` in en/pl/de/es
- [x] `docs/modules/backend-adapter.md` + `docs/decisions/002-backend-adapter-seam.md` + index update
- [x] `npx tsc --noEmit` clean

#### Review

- The hooks layer is the single chokepoint — screens never `import { backend } from '@/backend'` directly.
- `profile.networkOn` gates every hook, so flipping `USE_REMOTE_BACKEND` true with network off still issues zero requests. Same opt-in posture as crash reporting.
- The mock is good enough for screenshots and dev work without a server; flipping in the Cloudflare adapter is a one-line change in `src/backend/index.ts` (plus actually shipping the Worker — see ADR 002 for the planned wiring).
- `wipeAll` rotates `backendUserId` so a wiped install is indistinguishable from a fresh one to the server.

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
- For a real build: `pnpm install`, set `EXPO_PUBLIC_SENTRY_DSN`, then run with a dev client (Expo Go won't capture native crashes).

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
- [x] `src/ai/chatAdapter.ts` — chat adapter seam with AI SDK Gemini cloud POC (`GEMINI_API_KEY`) + mock fallback
- [x] `Chat.tsx` now streams through `chatAdapter`, passing user-state + insects dataset context for grounded replies
- [x] `docs/modules/chat-gemini-poc.md` + roadmap/index updates mark cloud Gemini as temporary proof-of-concept
- [x] Chat history now persists by default in `chatThreads` (Zustand persist, keyed `persona::topic`)
- [x] Chat header includes a current-thread wipe button (trash icon) that clears only active transcript
- [x] Cross-thread conversation memory index (`conversationMemory`) with keyword tagging + retrieval into prompt context
- [x] Brains screen adds "Wipe stored conversations" action to clear transcripts + memory index

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
- ~~Real leaderboard / friend graph / suggested feed~~ — Worker shipped in `worker/`. Set `EXPO_PUBLIC_BACKEND_URL` to activate (`USE_REMOTE_BACKEND` auto-flips). Provision D1 + KV + secret per `worker/wrangler.toml`.
- ~~Real activity events from other users~~ — see above; `FeedInbox` Durable Object fans out catch/follow events to follower inboxes server-side.
- Cross-device sync (intentionally not in the design — the app is account-less by promise)

### Needs substantial native / infra work
- Real map tiles via `react-native-maps` + provider key + native config
- ~~Real BugNet / Larva-3B / Regional pack downloads~~ — regional pack system shipped (PR #22): manifest → pack JSON → `.pte` model download chain, `installRegion` / `uninstallRegion` store actions, `useExecutorchClassifier` parameterised hook. Activate by hosting pack files and flipping `USE_NATIVE_VISION = true`.

### Needs richer classifier output
- Real lookalike-distinguished signal for badge b5 — current classifier returns argmax, not "distinguished mimics"
- Real Quest q1 photo-trait detection (currently driven by stored `BUGS.traits`, not by the classifier inferring "this is a pollinator" from the image)

### Localization stretch
- [x] iOS/Android native locale auto-detection — `Intl.DateTimeFormat().resolvedOptions().locale` on first launch (PR #21)
- RTL language support — would need `I18nManager.forceRTL()` + layout review
- Translation lint script — diff pack keys vs English source, warn on missing

## Workflow

1. Pick a task. Move it to `in-progress` (or just leave the box unchecked and start working).
2. Implement the slice end-to-end in one branch.
3. `npm run typecheck` clean before commit.
4. Tick the box in this file *in the same commit* as the implementation.
5. After a batch lands, summarize in a "Review" section here and link the commit hash.

Lessons learned mid-task go in [[tasks/lessons]].
