import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLeaderboard } from '@/backend/hooks';
import type { LeaderboardEntry, LeaderboardScope } from '@/backend';
import { PersonModal } from '@/components/PersonModal';
import { LEADERS, type LeaderRow } from '@/data/leaderboard';
import { countryName, useT } from '@/i18n/helpers';
import { useXp } from '@/lib/level';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const TABS: LeaderboardScope[] = ['global', 'weekly', 'friends'];
type TabName = LeaderboardScope;

const PODIUM_STYLE = [
  { h: 80,  c: PB.cream2, place: '2', medal: '🥈' },
  { h: 110, c: PB.yellow, place: '1', medal: '👑' },
  { h: 64,  c: PB.orange, place: '3', medal: '🥉' },
];

export function Leaderboard() {
  const { go } = useNav();
  const profile = useAppStore((s) => s.profile);
  const language = useAppStore((s) => s.language);
  const userXp = useXp();
  const t = useT();
  const [tab, setTab] = useState<TabName>('global');
  const [openName, setOpenName] = useState<string | null>(null);

  const userVisible = profile.networkOn && profile.leaderboardOn;
  const userCountry = profile.locationShareOn && profile.networkOn ? 'US' : 'private';

  // Backend-fed leaderboard. While offline (`networkOn === false`) the
  // hook short-circuits to `data: null` — fall back to the same in-app
  // synthesis we used before the seam was introduced so the screen
  // still has something to render. When online the data comes from the
  // mock adapter today, swappable to Cloudflare with one flag flip.
  const { data: page } = useLeaderboard(tab);

  const sorted = useMemo<LeaderboardEntry[]>(() => {
    if (page) return page.entries;
    // Offline fallback: same synthesis as Tier B — user's XP in their
    // slot, re-sorted, ranks renumbered.
    const next = LEADERS.map<LeaderRow>((l) => (l.self ? { ...l, xp: userXp } : l));
    next.sort((a, b) => b.xp - a.xp);
    return next.map<LeaderboardEntry>((l, i) => ({
      userId: l.self ? profile.name : l.name,
      displayName: l.name,
      xp: l.xp,
      rank: i + 1,
      country: l.country,
      rankDelta: null,
      ...(l.self ? { isSelf: true } : {}),
    }));
  }, [page, userXp, profile.name]);

  const podium = useMemo(() => {
    const top = [sorted[0], sorted[1], sorted[2]];
    return [
      { row: top[1], ...PODIUM_STYLE[0] },
      { row: top[0], ...PODIUM_STYLE[1] },
      { row: top[2], ...PODIUM_STYLE[2] },
    ];
  }, [sorted]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
        <Text style={styles.sub}>{t('leaderboard.sub')}</Text>
        <View style={styles.tabs}>
          {TABS.map((tabId) => (
            <Pressable
              key={tabId}
              onPress={() => (tabId === 'friends' ? go('friends') : setTab(tabId))}
              style={[
                styles.tab,
                {
                  backgroundColor: tab === tabId ? PB.yellow : 'transparent',
                },
              ]}
            >
              <Text style={[styles.tabText, { color: tab === tabId ? PB.ink : PB.cream }]}>
                {t(`leaderboard.tab.${tabId}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.podium}>
        {podium.map((p) => {
          if (!p.row) return null;
          const row = p.row;
          const displayName = row.isSelf ? profile.name : row.displayName;
          return (
            <Pressable
              key={row.rank}
              onPress={() => setOpenName(row.isSelf ? 'you' : row.displayName)}
              style={{ flex: 1, alignItems: 'center' }}
            >
              <View style={styles.medal}>
                <Text style={{ fontSize: 20 }}>{p.medal}</Text>
              </View>
              <Text style={styles.podiumName}>{displayName}</Text>
              <View
                style={[
                  styles.podiumBar,
                  { backgroundColor: p.c, height: p.h },
                ]}
              >
                <Text style={styles.podiumPlace}>{p.place}</Text>
                <Text style={styles.podiumXp}>{row.xp.toLocaleString()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {sorted.slice(3).map((l) => {
            if (l.isSelf && !userVisible) return null;
            const name = l.isSelf ? profile.name : l.displayName;
            const country = l.isSelf ? userCountry : (l.country ?? 'private');
            return (
              <Pressable
                key={`${l.userId}-${l.rank}`}
                onPress={() => setOpenName(l.isSelf ? 'you' : l.displayName)}
                style={[
                  styles.row,
                  { backgroundColor: l.isSelf ? PB.yellow : PB.paper },
                ]}
              >
                <Text style={styles.rank}>{l.rank}</Text>
                <View style={styles.avatar}>
                  <Text>🐛</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {name}
                    {l.isSelf ? ` ${t('common.youParen')}` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    {t('leaderboard.meta', { country: countryName(language, country) })}
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
                <Text style={styles.hiddenTitle}>{t('leaderboard.hiddenTitle')}</Text>
                <Text style={styles.hiddenDesc}>{t('leaderboard.hiddenDesc')}</Text>
              </View>
              <View style={styles.fix}>
                <Text style={styles.fixText}>{t('leaderboard.fix')}</Text>
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
