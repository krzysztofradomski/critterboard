import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

// Configure ExecuTorch to use Expo's file-system for caching downloaded models.
// Must be called before any ClassificationModule is instantiated.
initExecutorch({ resourceFetcher: ExpoResourceFetcher });
import { StyleSheet, View } from 'react-native';

import { useBackendIdentityBridge, useSyncProfile } from '@/backend/hooks';
import { Toast } from '@/components/Toast';
import { hydrateCachedPacks, syncRemotePacks, isKnownLang } from '@/i18n';
import { hydrateInstalledPacks } from '@/data/regionPacks';
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
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const installedRegions = useAppStore((s) => s.installedRegions);

  // Keep the mock adapter's self-view in sync with live store state.
  useBackendIdentityBridge();
  // Push profile changes (name, leaderboard visibility, location share)
  // to the Cloudflare Worker whenever they change. Gated on networkOn.
  useSyncProfile();

  // On first launch, seed the language from the device locale so users
  // with a supported language don't have to visit Settings manually.
  // Only runs before onboarding; after that the user's explicit choice wins.
  useEffect(() => {
    if (hasOnboarded) return;
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "de-DE"
      const tag = locale.split('-')[0]?.toLowerCase();               // "de"
      if (tag && isKnownLang(tag)) setLanguage(tag);
    } catch {
      // Intl unavailable — keep the default English.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Merge each installed region pack's species into the in-memory bug
  // registry so findBug() covers all downloaded packs after every cold
  // launch. Runs again after store rehydration (installedRegions dependency)
  // in case the store wasn't ready on the first render.
  useEffect(() => {
    if (installedRegions.length > 0) void hydrateInstalledPacks(installedRegions);
  }, [installedRegions]);

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
      <View style={styles.shell}>
        <View style={styles.root}>
          <StatusBar style="dark" />
          <Router />
          <Toast toast={toast} />
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: PB.cream2,
    alignItems: 'center',
  },
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    backgroundColor: PB.cream,
  },
});
