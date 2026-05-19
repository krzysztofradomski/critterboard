import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import { Toast } from '@/components/Toast';
import { Router } from '@/navigation/Router';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

export default function App() {
  const toast = useAppStore((s) => s.toast);
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
