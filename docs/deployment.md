# Deployment — TestFlight & Google Play

#deployment #release

How Critterboard ships to **iOS TestFlight** and **Google Play internal testing** via [EAS](https://docs.expo.dev/eas/) (Expo Application Services). Managed workflow — no `ios/` or `android/` folders are committed; EAS prebuilds in the cloud.

## TL;DR

`eas-cli` is pinned as a dev dependency, so after `npm install` you don't
need a global install — call it with `npx eas-cli`. (Install globally with
`npm install -g eas-cli` if you'd rather type `eas` directly.)

```bash
# one-time
npm install
npx eas-cli login
npx eas-cli init            # creates the EAS project, writes extra.eas.projectId into app.json

# build
npm run build:ios           # production .ipa  -> TestFlight
npm run build:android       # production .aab  -> Play internal track

# upload to the stores
npm run submit:ios
npm run submit:android
```

> `eas: command not found` means `eas-cli` isn't on your PATH. Either run
> `npm install` (then use the `npm run build:*` / `npx eas-cli` forms above)
> or install it globally with `npm install -g eas-cli`.

## Build profiles (`eas.json`)

| Profile | Distribution | iOS | Android | Use |
|---|---|---|---|---|
| `development` | internal | simulator + dev client | `.apk` | day-to-day dev client |
| `preview` | internal | device build, ad-hoc | `.apk` | share a testable build over a link |
| `production` | store | App Store / TestFlight | `.aab` (app bundle) | what gets submitted |

`appVersionSource` is `remote` and `production` sets `autoIncrement: true`, so EAS owns the iOS **build number** and Android **versionCode** and bumps them every production build. The human-facing marketing version stays in `app.json` → `expo.version` (currently `1.4.0`) — bump it there for each release.

Each profile has a matching `channel` for EAS Update OTA delivery if/when that gets wired up.

## One-time setup

1. **Expo account + project** — `npx eas-cli login`, then `npx eas-cli init`. This writes `extra.eas.projectId` into `app.json`. Commit that change. (It is intentionally absent until you run this — a placeholder UUID would break builds.)
2. **App identifiers** — already set in `app.json`:
   - iOS `bundleIdentifier`: `app.critterboard.ios`
   - Android `package`: `app.critterboard.android`
3. **Apple credentials** — let EAS manage signing (recommended). On the first `npm run build:ios` it walks you through generating the distribution certificate and provisioning profile. You need an Apple Developer Program membership ($99/yr) and must create the app record in [App Store Connect](https://appstoreconnect.apple.com).
4. **Android credentials** — EAS generates and stores the upload keystore on first Android build. Create the app in the [Play Console](https://play.google.com/console) ($25 one-time).

## Submitting

Fill in the placeholders in `eas.json` → `submit.production` before running the `npm run submit:*` scripts:

**iOS**
- `appleId` — your Apple account email
- `ascAppId` — the App Store Connect app's numeric Apple ID (App Store Connect → App → App Information)
- `appleTeamId` — your 10-char Apple Developer Team ID

**Android**
- `serviceAccountKeyPath` — `./google-service-account.json`, a Play Console service-account key with the *Service Account User* role. **Git-ignored — never commit it.**
- `track` — `internal` (internal testing). Promote to `alpha` / `beta` / `production` later in the Play Console.

After `npm run submit:ios`, the build appears in TestFlight once Apple finishes processing (a few minutes to an hour). Add it to an internal or external test group from App Store Connect. For Android, the build lands on the **internal testing** track in the Play Console.

## Secrets & env

Runtime config uses `EXPO_PUBLIC_*` vars (see [`.env.example`](../.env.example)). For cloud builds these are **not** read from your local `.env` — set them as EAS secrets so the build can see them:

```bash
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "..."
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value "..."
```

Or add a non-secret `env` block per profile in `eas.json`. Keep real keys out of git either way.

## Checklist before a store build

- [ ] `npx eas-cli init` has run and `extra.eas.projectId` is committed
- [ ] `expo.version` bumped in `app.json` for the release
- [ ] App records created in App Store Connect and Play Console
- [ ] `submit.production` placeholders filled in `eas.json`
- [ ] `google-service-account.json` present locally (Android), git-ignored
- [ ] EAS secrets set for any `EXPO_PUBLIC_*` the app needs at runtime
- [ ] `npm run check` is green
