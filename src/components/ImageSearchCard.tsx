import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { searchPhoto } from '@/lib/searchPhoto';
import type { ImageSearchProvider } from '@/lib/imageSearch';
import { useAppStore } from '@/store/useAppStore';
import { PB } from '@/tokens/pb';

const PROVIDERS = [
  { id: 'google', name: 'Google Lens', mark: 'G', color: PB.yellow },
  { id: 'bing', name: 'Bing Visual Search', mark: 'b', color: PB.cream2 },
] as const;

export function ImageSearchCard({ photoUri }: { photoUri: string }) {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);
  const language = useAppStore((s) => s.language);
  const [sending, setSending] = useState<ImageSearchProvider | null>(null);
  const inFlight = useRef(false);
  const report = (key: string) => showToast({ text: t(`imageSearch.${key}`), icon: '🔎', bg: PB.yellow });

  const search = async (provider: ImageSearchProvider) => {
    if (inFlight.current) return;
    inFlight.current = true;
    haptics.tap();
    setSending(provider);
    try {
      const result = await searchPhoto(photoUri, provider, language);
      if (result !== 'opened') report(result);
    } finally {
      inFlight.current = false;
      setSending(null);
    }
  };

  return (
    <Sticker bg={PB.cream} style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><Text style={styles.iconText}>🔎</Text></View>
        <View style={styles.headingText}>
          <Text style={styles.title}>{t('imageSearch.title')}</Text>
          <Text style={styles.subtitle}>{t('imageSearch.subtitle')}</Text>
        </View>
      </View>
      <Text style={styles.footnote}>{t('imageSearch.privacy')}</Text>
      <View style={styles.providers}>
        {PROVIDERS.map((provider) => (
          <Pressable
            key={provider.name}
            accessibilityRole="button"
            accessibilityLabel={t('imageSearch.send', { provider: provider.name })}
            accessibilityHint={t('imageSearch.sendHint')}
            accessibilityState={{ disabled: sending !== null, busy: sending === provider.id }}
            disabled={sending !== null}
            onPress={() => void search(provider.id)}
            style={({ pressed }) => [styles.provider, pressed && styles.pressed, sending !== null && sending !== provider.id && styles.disabled]}
          >
            <View style={[styles.mark, { backgroundColor: provider.color }]}>
              <Text style={styles.markText}>{provider.mark}</Text>
            </View>
            <View style={styles.providerLabel}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <Text style={styles.providerHint} accessibilityLiveRegion="polite">{t(sending === provider.id ? 'imageSearch.sending' : 'imageSearch.browser')}</Text>
            </View>
            {sending === provider.id ? <ActivityIndicator color={PB.ink} /> : <Text style={styles.arrow}>↗</Text>}
          </Pressable>
        ))}
      </View>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14 },
  heading: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, borderColor: PB.ink, backgroundColor: PB.yellow, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  headingText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: PB.ink },
  subtitle: { fontSize: 12, color: PB.ink, marginTop: 2, lineHeight: 17 },
  disabled: { opacity: 0.5 },
  providers: { gap: 10, marginTop: 14 },
  provider: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, padding: 10, borderWidth: 2, borderColor: PB.ink, borderRadius: 12, backgroundColor: PB.paper },
  pressed: { backgroundColor: PB.cream2 },
  mark: { width: 34, height: 34, borderRadius: 10, borderWidth: 2, borderColor: PB.ink, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 20, fontWeight: '800', color: PB.ink },
  providerLabel: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '800', color: PB.ink },
  providerHint: { fontSize: 11, color: PB.ink, marginTop: 2 },
  arrow: { fontSize: 22, fontWeight: '800', color: PB.ink },
  footnote: { marginTop: 12, fontSize: 12, lineHeight: 18, color: PB.ink },
});
