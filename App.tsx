import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import { Toast } from '@/components/Toast';
import { hydrateCachedPacks, syncRemotePacks } from '@/i18n';
import { Router } from '@/navigation/Router';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

export default function App() {
  const toast = useAppStore((s) => s.toast);

  // Replay any cached remote translation packs before first paint
  // (cheap — AsyncStorage reads in parallel) then opportunistically
  // check for newer packs over the network. Both are best-effort: a
  // failure here just leaves the bundled English-source packs in place.
  useEffect(() => {
    void hydrateCachedPacks(['en', 'pl', 'de', 'es']).then(() => syncRemotePacks());
  }, []);

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
