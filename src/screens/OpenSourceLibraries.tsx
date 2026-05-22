import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { useNav } from '@/store/useNav';
import { PB } from '@/tokens/pb';

type Library = {
  name: string;
  version: string;
};

const GOOGLE_SEARCH_BASE = 'https://www.google.com/search?q=';

function packageSearchUrl(packageName: string): string {
  return `${GOOGLE_SEARCH_BASE}${encodeURIComponent(`${packageName} npm`)}`;
}

async function openPackageSearch(packageName: string): Promise<void> {
  await Linking.openURL(packageSearchUrl(packageName));
}

const RUNTIME_LIBRARIES: readonly Library[] = [
  { name: '@ai-sdk/google', version: '^3.0.79' },
  { name: '@expo/metro-runtime', version: '~4.0.1' },
  { name: '@react-native-async-storage/async-storage', version: '1.23.1' },
  { name: '@sentry/react-native', version: '~6.3.0' },
  { name: 'ai', version: '^6.0.190' },
  { name: 'expo', version: '~52.0.0' },
  { name: 'expo-asset', version: '~11.0.5' },
  { name: 'expo-camera', version: '~16.0.18' },
  { name: 'expo-file-system', version: '~18.0.12' },
  { name: 'expo-haptics', version: '~14.0.1' },
  { name: 'expo-image-picker', version: '~16.0.6' },
  { name: 'expo-location', version: '~18.0.10' },
  { name: 'expo-notifications', version: '~0.29.14' },
  { name: 'expo-sharing', version: '~13.0.1' },
  { name: 'expo-status-bar', version: '~2.0.0' },
  { name: 'react', version: '18.3.1' },
  { name: 'react-dom', version: '18.3.1' },
  { name: 'react-native', version: '0.76.5' },
  { name: 'react-native-gesture-handler', version: '~2.20.2' },
  { name: 'react-native-reanimated', version: '~3.16.1' },
  { name: 'react-native-safe-area-context', version: '4.12.0' },
  { name: 'react-native-screens', version: '~4.4.0' },
  { name: 'react-native-svg', version: '15.8.0' },
  { name: 'react-native-web', version: '~0.19.13' },
  { name: 'zustand', version: '^5.0.2' },
];

const DEV_LIBRARIES: readonly Library[] = [
  { name: '@babel/core', version: '^7.25.2' },
  { name: '@types/react', version: '~18.3.12' },
  { name: 'babel-plugin-module-resolver', version: '^5.0.3' },
  { name: 'babel-preset-expo', version: '~12.0.0' },
  { name: 'typescript', version: '~5.3.3' },
];

function DependencySection({
  title,
  subtitle,
  libs,
}: {
  title: string;
  subtitle: string;
  libs: readonly Library[];
}) {
  return (
    <Sticker bg={PB.paper} style={{ padding: 0 }}>
      <View style={styles.sectionHeader}>
        <Text style={{ fontSize: 24 }}>{title === 'Runtime dependencies' ? '📦' : '🛠️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>
        {libs.map((lib) => (
            <Pressable
              key={lib.name}
              style={styles.row}
              onPress={() => {
                void openPackageSearch(lib.name);
              }}
              accessibilityRole="link"
              accessibilityHint={`Search Google for ${lib.name}`}
            >
              <Text style={styles.rowName}>{lib.name}</Text>
              <View style={styles.rowRight}>
                <View style={styles.versionPill}>
                  <Text style={styles.versionText}>{lib.version}</Text>
                </View>
                <Text style={styles.rowLink}>🔎</Text>
              </View>
            </Pressable>
        ))}
      </View>
    </Sticker>
  );
}

export function OpenSourceLibraries() {
  const { back } = useNav();

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Open source libraries</Text>
          <Text style={styles.sub}>Third-party dependencies used by Critterboard</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <DependencySection
          title="Runtime dependencies"
          subtitle={`${RUNTIME_LIBRARIES.length} packages bundled with the app`}
          libs={RUNTIME_LIBRARIES}
        />
        <DependencySection
          title="Development dependencies"
          subtitle={`${DEV_LIBRARIES.length} packages used in tooling/build`}
          libs={DEV_LIBRARIES}
        />
        <Text style={styles.footer}>Tap any package row to open a Google search.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  head: {
    padding: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    backgroundColor: PB.pink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: PB.cream, lineHeight: 22 },
  sub: { fontSize: 11, color: PB.cream, opacity: 0.9, marginTop: 2 },
  scroll: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, gap: 12 },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: PB.blue,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 15.5,
    borderTopRightRadius: 15.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  sectionSub: { fontSize: 12, color: PB.cream, opacity: 0.92, marginTop: 3, fontWeight: '600' },
  sectionBody: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: PB.cream,
  },
  rowName: { flex: 1, fontSize: 12, fontWeight: '700', color: PB.ink },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  versionPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.yellow,
  },
  versionText: { fontSize: 10, fontWeight: '800', color: PB.ink },
  rowLink: { fontSize: 14 },
  footer: {
    marginTop: 2,
    fontSize: 11,
    color: PB.ink,
    opacity: 0.6,
    fontWeight: '600',
    textAlign: 'center',
  },
});
