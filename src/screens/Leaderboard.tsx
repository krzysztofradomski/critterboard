import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PersonModal } from '@/components/PersonModal';
import { LEADERS } from '@/data/leaderboard';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const TABS = ['Global', 'Weekly', 'Friends'] as const;
type TabName = (typeof TABS)[number];

const PODIUM = [
  { ...(LEADERS[1] as (typeof LEADERS)[number]), h: 80, c: PB.cream2, place: '2', medal: '🥈' },
  { ...(LEADERS[0] as (typeof LEADERS)[number]), h: 110, c: PB.yellow, place: '1', medal: '👑' },
  { ...(LEADERS[2] as (typeof LEADERS)[number]), h: 64, c: PB.orange, place: '3', medal: '🥉' },
];

export function Leaderboard() {
  const { go } = useNav();
  const profile = useAppStore((s) => s.profile);
  const [tab, setTab] = useState<TabName>('Global');
  const [openName, setOpenName] = useState<string | null>(null);

  const userVisible = profile.networkOn && profile.leaderboardOn;
  const userCountry = profile.locationShareOn && profile.networkOn ? 'US' : 'private';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.sub}>Resets in 3d 14h · 482k trainers</Text>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => (t === 'Friends' ? go('friends') : setTab(t))}
              style={[
                styles.tab,
                {
                  backgroundColor: tab === t ? PB.yellow : 'transparent',
                },
              ]}
            >
              <Text style={[styles.tabText, { color: tab === t ? PB.ink : PB.cream }]}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.podium}>
        {PODIUM.map((p) => (
          <Pressable
            key={p.rank}
            onPress={() => setOpenName(p.name)}
            style={{ flex: 1, alignItems: 'center' }}
          >
            <View style={styles.medal}>
              <Text style={{ fontSize: 20 }}>{p.medal}</Text>
            </View>
            <Text style={styles.podiumName}>{p.name}</Text>
            <View
              style={[
                styles.podiumBar,
                { backgroundColor: p.c, height: p.h },
              ]}
            >
              <Text style={styles.podiumPlace}>{p.place}</Text>
              <Text style={styles.podiumXp}>{p.xp.toLocaleString()}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.list}>
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {LEADERS.slice(3).map((l) => {
            if (l.self && !userVisible) return null;
            const name = l.self ? profile.name : l.name;
            const country = l.self ? userCountry : l.country;
            return (
              <Pressable
                key={l.rank}
                onPress={() => setOpenName(l.self ? 'you' : l.name)}
                style={[
                  styles.row,
                  { backgroundColor: l.self ? PB.yellow : PB.paper },
                ]}
              >
                <Text style={styles.rank}>{l.rank}</Text>
                <View style={styles.avatar}>
                  <Text>🐛</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {name}
                    {l.self ? ' (you)' : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {country} · level 12
                  </Text>
                </View>
                <Text style={styles.xp}>{l.xp.toLocaleString()}</Text>
              </Pressable>
            );
          })}

          {!userVisible && (
            <Pressable onPress={() => go('settings')} style={styles.hiddenRow}>
              <Text style={{ fontSize: 22 }}>🔒</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.hiddenTitle}>You are hidden from rankings</Text>
                <Text style={styles.hiddenDesc}>Turn on "Show me on leaderboard" to appear.</Text>
              </View>
              <View style={styles.fix}>
                <Text style={styles.fixText}>FIX →</Text>
              </View>
            </Pressable>
          )}
        </ScrollView>
      </View>

      <PersonModal
        name={openName}
        visible={!!openName}
        onClose={() => setOpenName(null)}
        mutuals={openName === 'you' ? 0 : 2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.purple },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 14 },
  title: { fontSize: 30, fontWeight: '800', color: PB.cream, lineHeight: 30 },
  sub: { fontSize: 13, color: PB.cream, opacity: 0.85, fontWeight: '600', marginTop: 4 },
  tabs: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: PB.ink,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '800' },
  podium: { paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  medal: {
    width: 48,
    height: 48,
    borderRadius: 99,
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
  podiumName: { fontSize: 11, fontWeight: '800', color: PB.cream, marginTop: 6 },
  podiumBar: {
    marginTop: 4,
    width: '100%',
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    paddingTop: 8,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  podiumPlace: { fontSize: 22, fontWeight: '800', color: PB.ink },
  podiumXp: { fontSize: 10, fontWeight: '700', color: PB.ink, opacity: 0.7 },
  list: {
    flex: 1,
    backgroundColor: PB.cream,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    padding: 12,
    marginBottom: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  rank: { fontSize: 18, fontWeight: '800', color: PB.ink, width: 32, textAlign: 'center' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.cream2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '800', color: PB.ink },
  meta: { fontSize: 11, color: PB.ink, opacity: 0.6 },
  xp: { fontSize: 14, fontWeight: '800', color: PB.ink },
  hiddenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 4,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  hiddenTitle: { fontSize: 13, fontWeight: '800', color: PB.ink },
  hiddenDesc: { fontSize: 11, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 2 },
  fix: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  fixText: { fontSize: 11, fontWeight: '800', color: PB.ink },
});
