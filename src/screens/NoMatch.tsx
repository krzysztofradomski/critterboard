import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

export function NoMatch() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const P = usePersona(persona);
  const t = useT();

  const TIPS = [
    { emoji: '🔆', titleKey: 'noMatch.tip.lightTitle',    descKey: 'noMatch.tip.lightDesc',    color: PB.yellow },
    { emoji: '🔍', titleKey: 'noMatch.tip.frameTitle',    descKey: 'noMatch.tip.frameDesc',    color: PB.green  },
    { emoji: '🌿', titleKey: 'noMatch.tip.backdropTitle', descKey: 'noMatch.tip.backdropDesc', color: PB.blue   },
    { emoji: '📐', titleKey: 'noMatch.tip.profileTitle',  descKey: 'noMatch.tip.profileDesc',  color: PB.purple },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={styles.title}>{t('noMatch.headTitle')}</Text>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 30 }}>
        <Sticker bg={PB.red} rotate={-2} style={{ paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center' }}>
          <Text style={{ fontSize: 60 }}>🤷</Text>
          <Text style={styles.heroTitle}>{t('noMatch.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('noMatch.heroSub')}</Text>
        </Sticker>

        <Sticker bg={P.cardBg} rotate={1.2} style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={[styles.snarkAvatar, { backgroundColor: PB.cream }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <Text style={styles.snark}>{P.noMatch}</Text>
          </View>
        </Sticker>

        <Text style={styles.section}>{t('noMatch.tryThis')}</Text>
        <View style={styles.tipGrid}>
          {TIPS.map((tip) => (
            <View key={tip.titleKey} style={styles.tipCard}>
              <View style={[styles.tipIcon, { backgroundColor: tip.color }]}>
                <Text style={{ fontSize: 18 }}>{tip.emoji}</Text>
              </View>
              <Text style={styles.tipTitle}>{t(tip.titleKey)}</Text>
              <Text style={styles.tipDesc}>{t(tip.descKey)}</Text>
            </View>
          ))}
        </View>

        <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 18, padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={styles.qBox}>
              <Text style={{ fontSize: 20 }}>❓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qTitle}>{t('noMatch.saveTitle')}</Text>
              <Text style={styles.qDesc}>{t('noMatch.saveDesc')}</Text>
            </View>
          </View>
        </Sticker>

        <View style={{ marginTop: 16, gap: 10 }}>
          <Btn full bg={PB.ink} color={PB.yellow} size="lg" onPress={() => go('scan')}>
            {t('noMatch.tryAgain')}
          </Btn>
          <Btn full bg={PB.cream} color={PB.ink} onPress={() => go('home')}>
            {t('noMatch.saveAndHome')}
          </Btn>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontSize: 16, fontWeight: '800', color: PB.ink },
  heroTitle: { marginTop: 8, fontSize: 26, fontWeight: '800', color: PB.cream, lineHeight: 28, textAlign: 'center' },
  heroSub: { marginTop: 6, fontSize: 13, color: PB.cream, opacity: 0.95, fontWeight: '600', textAlign: 'center' },
  snarkAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snark: { flex: 1, fontSize: 14, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  section: { marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: '800', color: PB.ink, letterSpacing: 0.6 },
  tipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tipCard: {
    width: '47%',
    padding: 12,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tipTitle: { fontSize: 14, fontWeight: '800', color: PB.ink, lineHeight: 15 },
  tipDesc: { fontSize: 11, color: PB.ink, opacity: 0.7, marginTop: 4, fontWeight: '600', lineHeight: 14 },
  qBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qTitle: { fontSize: 15, fontWeight: '800', color: PB.ink, lineHeight: 16 },
  qDesc: { fontSize: 12, color: PB.ink, opacity: 0.7, marginTop: 3, fontWeight: '600' },
});
