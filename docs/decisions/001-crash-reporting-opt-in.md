# ADR 001 — Crash reporting is opt-in, not opt-out

`#adr` `#privacy`

> See also: [[../modules/crash-reporting]] (how it's wired).

## Context

Critterboard is positioned as an *on-device* insect ID app — the Settings screen literally promises "Everything runs on your phone." Adding any data path that leaves the device is a privacy-policy event, not a routine feature.

At the same time, we'd like crash reports for production builds. Without them, the only signal we get from a broken release is a one-star review.

## Decision

Use [`@sentry/react-native`](https://docs.sentry.io/platforms/react-native/) as the SDK — it's the industry standard, supports source maps, and has a working Expo integration.

Wrap it in `src/lib/crashReporting.ts` so the rest of the codebase never imports Sentry directly. The wrapper:

- Defaults to **disabled** on first run.
- Reads `EXPO_PUBLIC_SENTRY_DSN`; with no DSN it's a no-op even if the user has the toggle on.
- Is gated by the existing `networkOn` master switch — same pattern as leaderboard and location share.
- Lazy-loads the SDK via `require()` inside try/catch so missing native modules (Expo Go, hot dev rebuild) degrade to a console fallback rather than crashing.

## Alternatives considered

| Option | Why not |
|---|---|
| **No crash reporting at all** | Keeps the privacy story simplest, but leaves us blind in production. The toggle gives users the choice without taking it away. |
| **Opt-out (default on)** | Contradicts the "everything runs on your phone" promise. Even with a prominent first-run banner, the default determines real-world behaviour for ~95% of users. Non-starter. |
| **Custom in-app error log only** | Avoids third-party data sharing, but reinventing breadcrumbs, native crash hooks, and symbolication is a multi-week project we don't have budget for. |
| **Bugsnag / Datadog / Rollbar** | All viable. Sentry wins on Expo support and source-map tooling; the wrapper API is small enough to swap providers later (the in-tree consumer surface is `captureException` + `captureMessage`). |

## Consequences

- One more toggle in the Privacy section. Six toggles is still a digestible list; if we add a seventh we should consider grouping.
- `Profile` gains a field, so persisted profiles need a backfill — handled in the `wireStorage.getItem` deserializer (`{ crashReportingOn: false, ...wrapped.state.profile }`).
- Adding `@sentry/react-native` brings a sizable native dependency. For Expo Go users nothing changes (the wrapper degrades). For dev-client / production builds the install requires `expo prebuild` or the Expo config plugin.
- The wrapper imposes a soft contract: don't import Sentry anywhere else. Future contributors get one chokepoint to audit when the privacy story is questioned.
