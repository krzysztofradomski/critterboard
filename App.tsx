import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import { Toast } from '@/components/Toast';
import { hydrateCachedPacks, syncRemotePacks } from '@/i18n';
import { Router } from '@/navigation/Router';
import { syncStreakNudge } from '@/lib/notify';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

export default function App() {
  const toast = useAppStore((s) => s.toast);
  const catchLog = useAppStore((s) => s.catchLog);
  const persona = useAppStore((s) => s.persona);
  const language = useAppStore((s) => s.language);

  // Replay any cached remote translation packs before first paint
  // (cheap — AsyncStorage reads in parallel) then opportunistically
  // check for newer packs over the network. Both are best-effort: a
  // failure here just leaves the bundled English-source packs in place.
  useEffect(() => {
    void hydrateCachedPacks(['en', 'pl', 'de', 'es']).then(() => syncRemotePacks());
  }, []);

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
