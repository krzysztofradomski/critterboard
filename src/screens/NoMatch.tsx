import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { PERSONAS } from '@/personas';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const TIPS = [
  { emoji: '🔆', title: 'Brighter light',  desc: 'Move into the sun or use the flash. Shadow eats detail.', color: PB.yellow },
  { emoji: '🔍', title: 'Fill the frame',  desc: 'Get within 20 cm and crop tight on the body.',           color: PB.green  },
  { emoji: '🌿', title: 'Plain backdrop',  desc: 'Less foliage clutter helps the model focus.',            color: PB.blue   },
  { emoji: '📐', title: 'Side profile',    desc: 'Wings and legs visible from the side are easiest.',      color: PB.purple },
];

export function NoMatch() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const P = PERSONAS[persona];

  const sass = {
    larva:   'Nothing. I see leaves. Are you photographing leaves?',
    snail:   "No match this time. The light or the angle may be the issue — let's try again together.",
    maywind: "Hmm! Came up empty. New angle, brighter light, and we'll nail it!",
  }[P.id];

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={styles.title}>NO MATCH</Text>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 30 }}>
        <Sticker bg={PB.red} rotate={-2} style={{ paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center' }}>
          <Text style={{ fontSize: 60 }}>🤷</Text>
          <Text style={styles.heroTitle}>Couldn't ID this one.</Text>
          <Text style={styles.heroSub}>BugNet v3 returned all candidates below 15%.</Text>
        </Sticker>

        <Sticker bg={P.cardBg} rotate={1.2} style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={[styles.snarkAvatar, { backgroundColor: PB.cream }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <Text style={styles.snark}>{sass}</Text>
          </View>
        </Sticker>

        <Text style={styles.section}>TRY THIS</Text>
        <View style={styles.tipGrid}>
          {TIPS.map((t) => (
            <View key={t.title} style={styles.tipCard}>
              <View style={[styles.tipIcon, { backgroundColor: t.color }]}>
                <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
              </View>
              <Text style={styles.tipTitle}>{t.title}</Text>
              <Text style={styles.tipDesc}>{t.desc}</Text>
            </View>
          ))}
        </View>

        <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 18, padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={styles.qBox}>
              <Text style={{ fontSize: 20 }}>❓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qTitle}>Save as Unknown?</Text>
              <Text style={styles.qDesc}>
                Stash the photo in your journal. Re-ID it later when models improve.
              </Text>
            </View>
          </View>
        </Sticker>

        <View style={{ marginTop: 16, gap: 10 }}>
          <Btn full bg={PB.ink} color={PB.yellow} size="lg" onPress={() => go('scan')}>
            📷 Try again
          </Btn>
          <Btn full bg={PB.cream} color={PB.ink} onPress={() => go('home')}>
            Save & back to home
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
