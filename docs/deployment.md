# Deployment — TestFlight & Google Play

#deployment #release

How Critterboard ships to **iOS TestFlight** and **Google Play internal testing** via [EAS](https://docs.expo.dev/eas/) (Expo Application Services). Managed workflow — no `ios/` or `android/` folders are committed; EAS prebuilds in the cloud.

## TL;DR

`eas-cli` is pinned as a dev dependency, so after `pnpm install` you don't
need a global install — call it with `pnpm exec eas`. (Install globally
with `npm install -g eas-cli` if you'd rather type `eas` directly.)

```bash
# one-time
pnpm install
pnpm exec eas login
pnpm exec eas init          # creates the EAS project, writes extra.eas.projectId into app.json

# build
pnpm run build:dev-ios      # development client for a physical iPhone
pnpm run build:dev-android  # development client APK for Android
pnpm run build:ios          # production .ipa  -> TestFlight
pnpm run build:android      # production .aab  -> Play internal track

# upload to the stores
pnpm run submit:ios
pnpm run submit:android
```

> `eas: command not found` means `eas-cli` isn't on your PATH. Either run
> `pnpm install` (then use the `pnpm run build:*` / `pnpm exec eas` forms above)
> or install it globally with `npm install -g eas-cli`.

## Local builds with Xcode (no EAS)

On a Mac with Xcode you don't need EAS for day-to-day work. `expo run:ios`
generates `ios/` (git-ignored), builds with Xcode, installs the app and starts Metro:

```bash
pnpm install
pnpm ios:sim        # build + run on the iOS Simulator
pnpm ios:device     # build + run on a USB-connected iPhone (pick it from the list)
pnpm android:device # same for an Android phone / emulator
```

- **Signing on a phone:** Xcode signs with your Apple ID. A free "Personal Team"
  works for your own iPhone (apps expire after 7 days), but it can't grant the
  Push Notifications capability that `expo-notifications` adds. Either use a paid
  team, or remove that capability under Signing & Capabilities in Xcode for local
  builds. The app only schedules local notifications.
- **First run on the phone:** enable Settings → Privacy & Security → Developer
  Mode, and trust the developer profile under Settings → General → VPN & Device
  Management.
- **Env vars:** `EXPO_PUBLIC_*` values come from your local `.env`.
- **Simulator limits:** no camera (use the photo picker to test scanning). The
  on-device vision and LLM libraries may be slow or unsupported there; test
  those on a phone.
- Re-run the command after changing `app.json`, plugins or native dependencies.
  JS-only changes just hot-reload.

## Local device development

Critterboard targets Expo SDK 57. Use a **development client** for iPhone testing:

```bash
pnpm run build:dev-device
pnpm run start:dev
```

For an iPhone, prefer the explicit command:

```bash
pnpm run build:dev-ios
pnpm run start:dev
```

Install the generated dev-client build on an iOS 17+ phone, then scan the QR
code from that app. The App Store Expo Go binary is not the target for this
project. Expo Go is a fixed native app and can only open projects for the SDK
version bundled inside that installed Expo Go build; on iPhone, older or
alternate Expo Go binaries cannot be side-loaded. If Expo Go shows "Project is
incompatible with this version of Expo Go", keep SDK 57 and use the dev client
above.

`pnpm run start:go` is kept as an explicit escape hatch for quick web/plain
Expo Go experiments, but it is not the supported physical-device path for this
app.

The dev client registers the `critterboard://` URL scheme. If the terminal QR
code says "no usable data" from the iOS Camera app, first open the installed
Critterboard dev client and use its built-in launcher/QR scanner, or tap the
development server link from Safari. Rebuild the dev client after changing the
scheme because iOS URL schemes are native config.

The iOS deployment target is pinned through `expo-build-properties`:

```json
["expo-build-properties", { "ios": { "deploymentTarget": "17.0" } }]
```

Expo SDK 57 targets iOS 16.4+, but `react-native-executorch` declares
`s.platforms = { :ios => '17.0' }` in its podspec. EAS prebuild must therefore
generate a Podfile at iOS 17.0 or CocoaPods rejects the native dependency set.

`react-native-reanimated@4.5.x` also requires `react-native-worklets@0.10.x` as
a direct dependency for dev-client/runtime builds. `@expo/dom-webview@57.0.0`
is pinned to satisfy Expo 57's log-box peer graph; `expo-modules-core` should
stay transitive through Expo modules rather than being listed directly.

`llama.rn` is listed in `pnpm.onlyBuiltDependencies` because its postinstall
script downloads the native `rnllama.xcframework` EAS needs for iOS. If pnpm
ignores that script, Xcode later fails with missing `rnllama` headers.

## Build profiles (`eas.json`)

| Profile | Distribution | iOS | Android | Use |
|---|---|---|---|---|
| `development` | internal | simulator + dev client | `.apk` | day-to-day simulator dev client |
| `development-device` | internal | physical-device dev client | `.apk` | local testing on a real phone |
| `preview` | internal | device build, ad-hoc | `.apk` | share a testable build over a link |
| `production` | store | App Store / TestFlight | `.aab` (app bundle) | what gets submitted |

`appVersionSource` is `remote` and `production` sets `autoIncrement: true`, so EAS owns the iOS **build number** and Android **versionCode** and bumps them every production build. The human-facing marketing version stays in `app.json` → `expo.version` (currently `1.4.0`) — bump it there for each release.

Each profile has a matching `channel` for EAS Update OTA delivery if/when that gets wired up.

## One-time setup

1. **Expo account + project** — `pnpm exec eas login`, then `pnpm exec eas init`. This writes `extra.eas.projectId` into `app.json`. Commit that change. (It is intentionally absent until you run this — a placeholder UUID would break builds.)
2. **App identifiers** — already set in `app.json`:
   - iOS `bundleIdentifier`: `app.critterboard.ios`
   - Android `package`: `app.critterboard.android`
3. **Apple credentials** — let EAS manage signing (recommended). On the first `pnpm run build:ios` it walks you through generating the distribution certificate and provisioning profile. You need an Apple Developer Program membership ($99/yr) and must create the app record in [App Store Connect](https://appstoreconnect.apple.com).
4. **Physical iOS devices** — internal/ad-hoc dev builds must include the phone's UDID in the provisioning profile. If iOS installs the app but refuses to open it with an integrity warning, register the device with `pnpm exec eas device:create`, then rebuild the `development-device` profile with a fresh profile.
5. **Android credentials** — EAS generates and stores the upload keystore on first Android build. Create the app in the [Play Console](https://play.google.com/console) ($25 one-time).

## Submitting

Fill in the placeholders in `eas.json` → `submit.production` before running the `npm run submit:*` scripts:

**iOS**
- `appleId` — your Apple account email
- `ascAppId` — the App Store Connect app's numeric Apple ID (App Store Connect → App → App Information)
- `appleTeamId` — your 10-char Apple Developer Team ID

**Android**
- `serviceAccountKeyPath` — `./google-service-account.json`, a Play Console service-account key with the *Service Account User* role. **Git-ignored — never commit it.**
- `track` — `internal` (internal testing). Promote to `alpha` / `beta` / `production` later in the Play Console.

After `pnpm run submit:ios`, the build appears in TestFlight once Apple finishes processing (a few minutes to an hour). Add it to an internal or external test group from App Store Connect. For Android, the build lands on the **internal testing** track in the Play Console.

## Secrets & env

Runtime config uses `EXPO_PUBLIC_*` vars (see [`.env.example`](../.env.example)). For cloud builds these are **not** read from your local `.env` — set them as EAS secrets so the build can see them:

```bash
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "..."
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "..."
```

Or add a non-secret `env` block per profile in `eas.json`. Keep real keys out of git either way.

## Checklist before a store build

- [ ] `pnpm exec eas init` has run and `extra.eas.projectId` is committed
- [ ] `expo.version` bumped in `app.json` for the release
- [ ] App records created in App Store Connect and Play Console
- [ ] `submit.production` placeholders filled in `eas.json`
- [ ] `google-service-account.json` present locally (Android), git-ignored
- [ ] EAS secrets set for any `EXPO_PUBLIC_*` the app needs at runtime
- [ ] `pnpm run check` is green
