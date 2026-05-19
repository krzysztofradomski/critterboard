import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DataRow } from '@/components/DataRow';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const FAQ = [
  {
    id: 'faq1',
    q: 'Does Critterboard work without internet?',
    a: 'Yes. Vision, chat, and the species database all run on your phone. The only reason to turn on Network access is to share to the leaderboard or post sightings publicly.',
  },
  {
    id: 'faq2',
    q: 'Why is my ID confidence low?',
    a: "Usually one of three things: the photo is blurry, the bug fills less than 1/4 of the frame, or you're outside an installed regional pack. Try a closer crop, brighter light, and a side profile.",
  },
  {
    id: 'faq3',
    q: 'How do streak freezes work?',
    a: "You earn one freeze every 7 days of activity, capped at three banked. If you miss a day, the freeze auto-spends to keep your streak alive. You don't have to do anything.",
  },
  {
    id: 'faq4',
    q: "Can I use Critterboard if I'm colorblind?",
    a: "Yes. All confidence and rarity cues double-encode with shape and label. There's a high-contrast pass in development; ping us if a specific screen is hurting you.",
  },
  {
    id: 'faq5',
    q: 'Where do reference images come from?',
    a: "iNaturalist (CC-BY-NC) for photos; GBIF for ranges. We don't train on your photos — model updates ship from our side only.",
  },
  {
    id: 'faq6',
    q: 'How do I delete my data?',
    a: 'Scroll down to "Wipe everything." It nukes your dex, sightings, settings, and on-device models. Followers and leaderboard entries go too. There is no undo.',
  },
];

export function Help() {
  const { back } = useNav();
  const profile = useAppStore((s) => s.profile);
  const dex = useAppStore((s) => s.dex);
  const showToast = useAppStore((s) => s.showToast);
  const [openId, setOpenId] = useState<string | null>('faq1');
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Help & About</Text>
          <Text style={styles.sub}>FAQ, contact, your data.</Text>
        </View>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <Text style={styles.section}>FAQ</Text>
          {FAQ.map((f, i) => {
            const open = openId === f.id;
            return (
              <View
                key={f.id}
                style={{ borderTopColor: PB.cream2, borderTopWidth: i === 0 ? 0 : 1.5 }}
              >
                <Pressable onPress={() => setOpenId(open ? null : f.id)} style={styles.faqRow}>
                  <Text style={styles.faqQ}>{f.q}</Text>
                  <View style={[styles.plus, { backgroundColor: open ? PB.yellow : PB.cream }]}>
                    <Text
                      style={[
                        styles.plusText,
                        { transform: [{ rotate: open ? '45deg' : '0deg' }] },
                      ]}
                    >
                      +
                    </Text>
                  </View>
                </Pressable>
                {open && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    <View style={styles.faqAnswerBox}>
                      <Text style={styles.faqA}>{f.a}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </Sticker>

        <Sticker bg={PB.yellow} rotate={-1} style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={styles.contactIcon}>
              <Text style={{ fontSize: 22 }}>📬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Get in touch</Text>
              <Text style={styles.contactDesc}>
                A real human reads every message. Reply usually within 48 hours.
              </Text>
              <Text style={styles.contactEmail}>hello@critterboard.app</Text>
            </View>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={styles.dataHead}>
            <Text style={{ fontSize: 26 }}>💾</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dataTitle}>Your data</Text>
              <Text style={styles.dataSub}>It lives on your phone. Take it with you.</Text>
            </View>
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            <DataRow
              icon="⬇️"
              color={PB.cream2}
              title="Export my dex (JSON)"
              desc={`${dex.size} catches · 1 file · ~8 KB`}
              cta="Export"
              onPress={() => showToast({ text: 'dex-export-may18.json saved', icon: '⬇️', bg: PB.green })}
            />
            <DataRow
              icon="📷"
              color={PB.cream2}
              title="Export sightings (CSV)"
              desc="Photos stay on device — coordinates only"
              cta="Export"
              onPress={() => showToast({ text: 'sightings-may18.csv saved', icon: '📷', bg: PB.green })}
            />
            <DataRow
              icon="🧹"
              color={PB.cream2}
              title="Clear scan cache"
              desc="32 photos · 84 MB"
              cta="Clear"
              onPress={() => showToast({ text: 'Cache cleared', icon: '🧹', bg: PB.green })}
            />
            <DataRow
              icon="🔥"
              color={PB.red}
              dark
              title="Wipe everything"
              desc="Dex, sightings, models, settings. No undo."
              cta={confirmWipe ? 'Tap again to confirm' : 'Wipe'}
              onPress={() => {
                if (confirmWipe) {
                  showToast({ text: 'Wipe queued — restart the app.', icon: '🔥', bg: PB.red });
                  setConfirmWipe(false);
                } else {
                  setConfirmWipe(true);
                  setTimeout(() => setConfirmWipe(false), 3500);
                }
              }}
            />
          </View>
        </Sticker>

        <Sticker bg={PB.cream2} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={styles.appName}>Critterboard</Text>
          <Text style={styles.appBuild}>v1.4.0 · build 2026.05 · MIT-licensed</Text>
          <Text style={styles.appSpec}>
            iOS 16+ · 312 MB on disk · {profile.networkOn ? 'network ON' : 'fully offline'}
          </Text>
        </Sticker>
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
    backgroundColor: PB.blue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: PB.cream, lineHeight: 22 },
  sub: { fontSize: 11, color: PB.cream, opacity: 0.9, marginTop: 2 },
  scroll: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, gap: 12 },
  section: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingBottom: 6,
    fontSize: 10,
    fontWeight: '800',
    color: PB.ink,
    opacity: 0.7,
    letterSpacing: 0.6,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  faqQ: { flex: 1, fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 16 },
  plus: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontSize: 14, fontWeight: '800', color: PB.ink },
  faqAnswerBox: {
    padding: 12,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  faqA: { fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  contactTitle: { fontSize: 16, fontWeight: '800', color: PB.ink },
  contactDesc: { fontSize: 12, color: PB.ink, opacity: 0.7, marginTop: 3, fontWeight: '600', lineHeight: 16 },
  contactEmail: { marginTop: 10, fontSize: 12, color: PB.ink, fontWeight: '700' },
  dataHead: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: PB.green,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 15.5,
    borderTopRightRadius: 15.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dataTitle: { fontSize: 16, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  dataSub: { fontSize: 12, color: PB.cream, opacity: 0.92, marginTop: 3, fontWeight: '600' },
  appName: { fontSize: 14, fontWeight: '800', color: PB.ink },
  appBuild: { fontSize: 11, color: PB.ink, opacity: 0.6, marginTop: 4 },
  appSpec: { marginTop: 8, fontSize: 10, color: PB.ink, opacity: 0.55 },
});
