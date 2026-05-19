import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';

type Kind = 'social' | 'system';

type Item = {
  id: string;
  kind: Kind;
  emoji: string;
  color: string;
  title: string;
  sub: string;
  cta: string;
  go: () => void;
  hot?: boolean;
};

export function Activity() {
  const { go, back } = useNav();
  const [tab, setTab] = useState<'all' | Kind>('all');

  const items: Item[] = [
    { id: 'a1', kind: 'social', emoji: '🦋', color: PB.orange, title: 'antqueen liked your Monarch', sub: '2 hr ago · Brooklyn cluster', cta: 'View sighting', go: () => go('result', { id: 'mona' }) },
    { id: 'a2', kind: 'system', emoji: '🧠', color: PB.pink, title: 'Larva-3B v1.4 ready to install', sub: 'New jokes. Same vibe. 240 MB.', cta: 'Update', go: () => go('settings'), hot: true },
    { id: 'a3', kind: 'system', emoji: '🔥', color: PB.red, title: "4-day streak! Don't break it", sub: 'Catch one bug today. Even a hoverfly.', cta: 'Open scan', go: () => go('scan') },
    { id: 'a4', kind: 'social', emoji: '🥇', color: PB.yellow, title: 'You passed bug_dad_42', sub: "You're #6 on the global board.", cta: 'Leaderboard', go: () => go('leaderboard') },
    { id: 'a5', kind: 'system', emoji: '✨', color: PB.purple, title: 'Quest complete: 3 pollinators', sub: '+75 XP. Reward unlocked.', cta: 'Claim', go: () => go('quests') },
    { id: 'a6', kind: 'social', emoji: '🌙', color: PB.green, title: 'mothwhisperer caught a Luna Moth', sub: '420 m from you · 6 hr ago', cta: 'View on map', go: () => go('map') },
    { id: 'a7', kind: 'system', emoji: '📦', color: PB.blue, title: 'Regional pack: Northeast NA', sub: 'New seasonal index synced (+38 species).', cta: 'View pack', go: () => go('region', { id: 'na-ne' }) },
    { id: 'a8', kind: 'social', emoji: '🤖', color: PB.cream2, title: 'wingedfren replied to your hoverfly thread', sub: '"Pretty sure that\'s a Marmalade — wing bands."', cta: 'Open chat', go: () => go('chat', { topic: 'Hoverflies' }) },
  ];

  const filtered = tab === 'all' ? items : items.filter((i) => i.kind === tab);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Buzz</Text>
          <Text style={styles.sub}>{items.length} new since you opened the app</Text>
        </View>
        <IconBtn fs={14}>✓</IconBtn>
      </View>

      <View style={styles.tabs}>
        {(['all', 'social', 'system'] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[
              styles.tab,
              {
                backgroundColor: tab === id ? PB.ink : PB.cream2,
                shadowOpacity: tab === id ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.tabText, { color: tab === id ? PB.yellow : PB.ink }]}>
              {id === 'all' ? 'All' : id === 'social' ? 'Social' : 'System'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map((it) => (
          <Pressable key={it.id} onPress={it.go} style={styles.row}>
            {it.hot ? (
              <View style={styles.hot}>
                <Text style={styles.hotText}>NEW</Text>
              </View>
            ) : null}
            <View style={[styles.icon, { backgroundColor: it.color }]}>
              <Text style={{ fontSize: 22 }}>{it.emoji}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{it.title}</Text>
              <Text style={styles.rowSub}>{it.sub}</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{it.cta} →</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {filtered.length === 0 && (
          <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 20, padding: 18, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>🦗</Text>
            <Text style={styles.emptyTitle}>Crickets.</Text>
            <Text style={styles.emptySub}>Nothing here yet.</Text>
          </Sticker>
        )}
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
    backgroundColor: PB.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: PB.ink, lineHeight: 22 },
  sub: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 2 },
  tabs: { paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', gap: 6 },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  tabText: { fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 30, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 16,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    position: 'relative',
  },
  hot: {
    position: 'absolute',
    top: -6,
    right: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: PB.red,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  hotText: { fontSize: 9, fontWeight: '800', color: PB.cream, letterSpacing: 0.6 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  rowTitle: { fontSize: 14, fontWeight: '800', color: PB.ink, lineHeight: 17 },
  rowSub: { fontSize: 12, color: PB.ink, opacity: 0.7, marginTop: 3, fontWeight: '600', lineHeight: 16 },
  cta: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 9,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  ctaText: { fontSize: 10, fontWeight: '800', color: PB.ink, letterSpacing: 0.4 },
  emptyTitle: { marginTop: 6, fontSize: 16, fontWeight: '800', color: PB.ink },
  emptySub: { marginTop: 4, fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600' },
});
