import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { useCalendar, useStreakSummary } from '@/lib/streak';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Streak() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const P = usePersona(persona);
  const t = useT();

  // All derived live from the catchLog — drop, kill, restart, the numbers
  // are right. The "freezes" affordance is still placeholder until we
  // wire a streak-recovery action; carry a deterministic 2 for now.
  const { current: cur, best, total } = useStreakSummary();
  const calendar = useCalendar(35);
  const freezes = 2;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={styles.title}>{t('streak.headTitle')}</Text>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.cream} rotate={-1} style={{ paddingVertical: 20, paddingHorizontal: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={styles.hero}>
              <Text style={{ fontSize: 30 }}>🔥</Text>
              <Text style={styles.heroCur}>{cur}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle}>{t('streak.dayOnFire', { n: cur })}</Text>
              <Text style={styles.heroSass}>{P.streakSass}</Text>
            </View>
          </View>
        </Sticker>

        <View style={styles.statRow}>
          {[
            { k: t('streak.stat.current'), v: t('streak.currentValue', { n: cur }), c: PB.red },
            { k: t('streak.stat.best'),    v: t('streak.bestValue',    { n: best }), c: PB.purple },
            { k: t('streak.stat.caught'),  v: String(total),                           c: PB.green },
          ].map((s) => (
            <View key={s.k} style={styles.stat}>
              <Text style={[styles.statLabel, { color: s.c }]}>{s.k}</Text>
              <Text style={styles.statValue}>{s.v}</Text>
            </View>
          ))}
        </View>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <Text style={styles.calTitle}>{t('streak.calTitle')}</Text>
            <Text style={styles.calRange}>{t('streak.calRange')}</Text>
          </View>
          <View style={styles.dayLabels}>
            {DAYS.map((d, i) => (
              <Text key={i} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {calendar.map((cell) => {
              const { caught, isToday } = cell;
              const bg = caught ? PB.green : PB.cream2;
              const fg = caught ? PB.cream : PB.ink;
              const label = caught ? '✓' : '·';
              return (
                <View
                  key={cell.key}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: bg,
                      opacity: !caught && !isToday ? 0.6 : 1,
                      borderWidth: isToday ? 3.5 : 2,
                    },
                  ]}
                >
                  <Text style={[styles.cellText, { color: fg }]}>{label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            {[
              { c: PB.green,  l: t('streak.legend.caught'), e: '✓' },
              { c: PB.blue,   l: t('streak.legend.freeze'), e: '❄' },
              { c: PB.cream2, l: t('streak.legend.missed'), e: '·' },
            ].map((L) => (
              <View key={L.l} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: L.c }]}>
                  <Text style={[styles.legendDotText, { color: L.c === PB.cream2 ? PB.ink : PB.cream }]}>
                    {L.e}
                  </Text>
                </View>
                <Text style={styles.legendLabel}>{L.l}</Text>
              </View>
            ))}
          </View>
        </Sticker>

        <Sticker bg={PB.blue} style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.freezeIcon}>
              <Text style={{ fontSize: 24 }}>❄</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.freezeTitle}>{t('streak.freezeTitle')}</Text>
              <Text style={styles.freezeDesc}>{t('streak.freezeDesc')}</Text>
            </View>
            <View style={styles.freezeCount}>
              <Text style={styles.freezeCountText}>{freezes}</Text>
            </View>
          </View>
        </Sticker>

        <Btn full bg={PB.ink} color={PB.yellow} size="lg" onPress={() => go('scan')}>
          {t('streak.keepAlive')}
        </Btn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.orange, paddingTop: 50 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontSize: 16, fontWeight: '800', color: PB.ink },
  scroll: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 30, gap: 12 },
  hero: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderColor: PB.ink,
    borderWidth: 3,
    backgroundColor: PB.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  heroCur: { fontSize: 28, fontWeight: '800', color: PB.cream, lineHeight: 28, marginTop: 2 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: PB.ink, lineHeight: 24 },
  heroSass: { fontSize: 13, color: PB.ink, opacity: 0.7, marginTop: 6, fontWeight: '600', lineHeight: 17 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    padding: 10,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2.5, height: 2.5 },
    alignItems: 'center',
  },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontWeight: '800', color: PB.ink, marginTop: 2 },
  calTitle: { fontSize: 14, fontWeight: '800', color: PB.ink },
  calRange: { fontSize: 10, color: PB.ink, opacity: 0.55 },
  dayLabels: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { flex: 1, fontSize: 9, fontWeight: '800', color: PB.ink, opacity: 0.55, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '12.85%',
    aspectRatio: 1,
    margin: 3,
    borderColor: PB.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  cellText: { fontSize: 14, fontWeight: '800' },
  legend: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 16,
    height: 16,
    borderColor: PB.ink,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDotText: { fontSize: 9, fontWeight: '800' },
  legendLabel: { fontSize: 11, color: PB.ink, opacity: 0.7, fontWeight: '700' },
  freezeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
  freezeTitle: { fontSize: 16, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  freezeDesc: { fontSize: 12, color: PB.cream, opacity: 0.95, marginTop: 3, fontWeight: '600', lineHeight: 16 },
  freezeCount: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    minWidth: 36,
    alignItems: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  freezeCountText: { fontSize: 14, fontWeight: '800', color: PB.ink },
});
