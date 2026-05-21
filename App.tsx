import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import { useBackendIdentityBridge } from '@/backend/hooks';
import { Toast } from '@/components/Toast';
import { hydrateCachedPacks, syncRemotePacks } from '@/i18n';
import { Router } from '@/navigation/Router';
import { initCrashReporting, setCrashReportingEnabled } from '@/lib/crashReporting';
import { syncStreakNudge } from '@/lib/notify';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

export default function App() {
  const toast = useAppStore((s) => s.toast);
  const catchLog = useAppStore((s) => s.catchLog);
  const persona = useAppStore((s) => s.persona);
  const language = useAppStore((s) => s.language);
  const crashReportingOn = useAppStore((s) => s.profile.crashReportingOn);

  // Keep the backend adapter's view of the caller in sync with the
  // live store. Mock-only today; the real Cloudflare adapter will read
  // the same identity via a Bearer token derived from `backendUserId`.
  useBackendIdentityBridge();

  // Replay any cached remote translation packs before first paint
  // (cheap — AsyncStorage reads in parallel) then opportunistically
  // check for newer packs over the network. Both are best-effort: a
  // failure here just leaves the bundled English-source packs in place.
  useEffect(() => {
    void hydrateCachedPacks(['en', 'pl', 'de', 'es']).then(() => syncRemotePacks());
  }, []);

  // Boot the crash-reporting wrapper once with the rehydrated preference,
  // then keep the SDK in sync with later toggle flips. Both calls are
  // idempotent and degrade to a no-op when the DSN or native SDK is
  // unavailable, so it's safe to run in every build flavor.
  useEffect(() => {
    initCrashReporting(crashReportingOn);
    // Run only at mount; the next effect handles subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setCrashReportingEnabled(crashReportingOn);
  }, [crashReportingOn]);

  // Keep the daily streak nudge in sync with state. Each new catch, each
  // persona switch, and each language flip cancels any prior 18:00
  // notification and — if the user has a live streak with no catch
  // today — re-schedules a fresh one in the active persona's voice.
  useEffect(() => {
    void syncStreakNudge({ catchLog, persona, lang: language });
  }, [catchLog, persona, language]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <Router />
        <Toast toast={toast} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PB.cream,
  },
});
