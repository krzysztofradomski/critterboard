import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/i18n/helpers';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const WEEK_DAYS = [
  { d: 'M', x: 1 },
  { d: 'T', x: 1 },
  { d: 'W', x: 1 },
  { d: 'T', x: 1 },
  { d: 'F', x: 0 },
  { d: 'S', x: 0 },
  { d: 'S', x: 0 },
] as const;

export function Home() {
  const { go } = useNav();
  const persona = useAppStore((s) => s.persona);
  const dexSize = useAppStore((s) => s.dex.size);
  const P = usePersona(persona);
  const t = useT();

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <IconBtn onPress={() => go('activity')}>🔔</IconBtn>
        <Pressable onPress={() => go('streak')} style={styles.streakPill}>
          <Text style={{ fontSize: 14 }}>🔥</Text>
          <Text style={styles.streakText}>{t('home.streakPill', { days: 4 })}</Text>
        </Pressable>
        <IconBtn onPress={() => go('settings')}>⚙</IconBtn>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>{t('home.bugOfDay')}</Text>
        <Text style={styles.title}>{t('home.bugOfDayName')}</Text>

        <Sticker
          bg={PB.purple}
          rotate={-1.5}
          style={styles.heroSticker}
          onPress={() => go('scan', { hint: 'lhoc' })}
        >
          <View style={styles.heroImage}>
            <CameraScene />
            <View style={styles.legendaryBadge}>
              <Text style={styles.legendaryText}>{t('home.legendary')}</Text>
            </View>
            <View style={styles.huntBadge}>
              <Text style={styles.huntText}>{t('home.hunt')}</Text>
            </View>
          </View>
          <View style={{ padding: 14 }}>
            <Text style={styles.heroDesc}>
              {t('home.bugOfDayDesc')}
              <Text style={styles.xpInline}>{t('home.bugOfDayXp')}</Text>
              {t('home.bugOfDayDescTail')}
            </Text>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ marginTop: 14 }} onPress={() => go('streak')}>
          <View style={styles.weekHead}>
            <Text style={styles.weekTitle}>{t('home.yourWeek')}</Text>
            <Text style={styles.weekSub}>{t('home.daysToBadge', { n: 3 })}</Text>
          </View>
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <View
                key={i}
                style={[
                  styles.weekCell,
                  { backgroundColor: d.x ? PB.green : PB.cream2 },
                ]}
              >
                <Text style={[styles.weekCellText, { color: d.x ? PB.cream : PB.ink }]}>
                  {d.x ? '✓' : d.d}
                </Text>
              </View>
            ))}
          </View>
        </Sticker>

        <Sticker bg={PB.yellow} rotate={1} style={{ marginTop: 14, padding: 12 }} onPress={() => go('chat')}>
          <View style={styles.chatRow}>
            <View style={[styles.chatAvatar, { backgroundColor: P.avatarBg }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatLine}>{P.lines.streak}</Text>
              <Text style={styles.chatCta}>{t('home.chatCta', { name: P.name.toUpperCase() })}</Text>
            </View>
          </View>
        </Sticker>

        <View style={styles.statRow}>
          {[
            { k: t('home.stat.caught'), v: String(dexSize), c: PB.blue,   route: 'dex' as const },
            { k: t('home.stat.xp'),     v: '24.6k',          c: PB.orange, route: 'quests' as const },
            { k: t('home.stat.rank'),   v: '#6',              c: PB.purple, route: 'leaderboard' as const },
          ].map((s) => (
            <Pressable
              key={s.k}
              onPress={() => go(s.route)}
              style={[styles.statTile, { backgroundColor: s.c }]}
            >
              <Text style={styles.statValue}>{s.v}</Text>
              <Text style={styles.statLabel}>{s.k}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <TabBar active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  topbar: { padding: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: PB.orange,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  streakText: { fontSize: 13, fontWeight: '800', color: PB.ink },
  scroll: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 130 },
  eyebrow: { fontSize: 13, fontWeight: '800', color: PB.ink, opacity: 0.65, letterSpacing: 0.5, marginTop: 6 },
  title: { fontSize: 30, fontWeight: '800', color: PB.ink, lineHeight: 30, marginTop: 2 },
  heroSticker: { marginTop: 14, padding: 0, overflow: 'hidden' },
  heroImage: { height: 200, position: 'relative', overflow: 'hidden' },
  legendaryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.pink,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  legendaryText: { fontSize: 11, fontWeight: '800', color: PB.ink },
  huntBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  huntText: { fontSize: 12, fontWeight: '800', color: PB.ink },
  heroDesc: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: PB.cream },
  xpInline: { backgroundColor: PB.yellow, color: PB.ink, fontWeight: '800' },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  weekTitle: { fontSize: 16, fontWeight: '800', color: PB.ink },
  weekSub: { fontSize: 12, color: PB.ink, opacity: 0.6, fontWeight: '600' },
  weekRow: { marginTop: 10, flexDirection: 'row', gap: 6 },
  weekCell: {
    flex: 1,
    aspectRatio: 1,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellText: { fontSize: 13, fontWeight: '800' },
  chatRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatLine: { fontSize: 14, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  chatCta: { marginTop: 6, fontSize: 11, fontWeight: '800', color: PB.ink, opacity: 0.7 },
  statRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  statValue: { fontSize: 22, fontWeight: '800', color: PB.cream, lineHeight: 22 },
  statLabel: { fontSize: 10, fontWeight: '800', color: PB.cream, opacity: 0.85, marginTop: 4, letterSpacing: 0.5 },
});
