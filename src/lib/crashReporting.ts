/**
 * Crash reporting — thin wrapper around `@sentry/react-native`.
 *
 * Three reasons for the indirection rather than calling Sentry directly:
 *
 * 1. **Opt-in by default.** Settings exposes a toggle bound to
 *    `profile.crashReportingOn` (off on first run). This wrapper is the
 *    single chokepoint that decides whether events are forwarded.
 * 2. **Graceful degradation.** The Sentry package is loaded via
 *    `require()` inside a try/catch. In Expo Go (no dev client) or when
 *    the dep simply isn't installed, the wrapper falls back to a
 *    `__DEV__`-only console logger. The toggle, the persisted prefs,
 *    and `captureException` callers all keep working — nothing crashes.
 * 3. **Privacy invariant.** With no DSN configured (the common dev
 *    case), `init` is a no-op even if the user has the toggle on. That
 *    way the "Everything runs on your phone" promise on the Settings
 *    screen isn't quietly broken by a leftover dev build.
 *
 * The DSN is read from `process.env.EXPO_PUBLIC_SENTRY_DSN` so it can
 * be set per-environment without checking secrets into the repo. See
 * `docs/modules/crash-reporting.md` for the full setup walkthrough.
 */

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  close: () => Promise<boolean> | void;
  captureException: (err: unknown) => void;
  captureMessage: (msg: string) => void;
  setUser: (user: { id?: string } | null) => void;
};

let sentry: SentryLike | null = null;
let initialized = false;
let dsn: string | undefined;

function loadSentry(): SentryLike | null {
  if (sentry) return sentry;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@sentry/react-native') as SentryLike;
    if (mod && typeof mod.init === 'function') {
      sentry = mod;
      return mod;
    }
  } catch {
    // Package not installed or native module unavailable (e.g. Expo Go
    // without a dev client). Fall through to the no-op path.
  }
  return null;
}

function resolveDsn(): string | undefined {
  // Expo inlines `EXPO_PUBLIC_*` at bundle time, so this is safe in the
  // RN runtime where `process.env` isn't otherwise populated. The cast
  // sidesteps `@types/node`'s empty default for `process.env`.
  const env = ((typeof process !== 'undefined' ? process.env : undefined) ??
    {}) as Record<string, string | undefined>;
  return env.EXPO_PUBLIC_SENTRY_DSN || env.SENTRY_DSN || undefined;
}

/**
 * Boot the SDK. Safe to call any number of times — repeat calls become
 * `setEnabled` underneath. Pass `enabled=false` on cold start when the
 * user hasn't opted in; the SDK stays inert until they flip the toggle.
 */
export function initCrashReporting(enabled: boolean): void {
  dsn = resolveDsn();
  if (!dsn) {
    // No DSN → never initialise. We still record the intent so the
    // toggle reads correctly in the UI; nothing is sent.
    if (__DEV__ && enabled) {
      // eslint-disable-next-line no-console
      console.info('[crash] toggle on, but no EXPO_PUBLIC_SENTRY_DSN — wrapper is a no-op.');
    }
    initialized = true;
    return;
  }
  if (!enabled) {
    initialized = true;
    return;
  }
  const sdk = loadSentry();
  if (!sdk) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info('[crash] @sentry/react-native unavailable — using console fallback.');
    }
    initialized = true;
    return;
  }
  sdk.init({
    dsn,
    enabled: true,
    // Don't ship PII. Default for the RN SDK is already false but make
    // it explicit so a future Sentry version change doesn't leak names.
    sendDefaultPii: false,
    // Modest sampling; this is a hobby-scale app and we never want
    // performance traces to cost more than the crash signal itself.
    tracesSampleRate: 0,
  });
  initialized = true;
}

/**
 * Flip the SDK on or off without re-initialising. When turning off we
 * call `close()` so any queued events are dropped, satisfying the
 * "stop sending" expectation the user has when they untick the box.
 */
export function setCrashReportingEnabled(enabled: boolean): void {
  if (!initialized) {
    initCrashReporting(enabled);
    return;
  }
  const sdk = loadSentry();
  if (!sdk) return;
  if (enabled) {
    if (!dsn) {
      dsn = resolveDsn();
      if (!dsn) return;
    }
    sdk.init({ dsn, enabled: true, sendDefaultPii: false, tracesSampleRate: 0 });
  } else {
    void sdk.close();
  }
}

export function captureException(err: unknown): void {
  const sdk = loadSentry();
  if (sdk) {
    sdk.captureException(err);
  } else if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[crash] captureException (no SDK):', err);
  }
}

export function captureMessage(msg: string): void {
  const sdk = loadSentry();
  if (sdk) {
    sdk.captureMessage(msg);
  } else if (__DEV__) {
    // eslint-disable-next-line no-console
    console.info('[crash] captureMessage (no SDK):', msg);
  }
}
