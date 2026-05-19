import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { PersonModal } from '@/components/PersonModal';
import { Sticker } from '@/components/Sticker';
import { FRIENDS, INITIAL_FOLLOWED, PERSON_PROFILES } from '@/data/personProfiles';
import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';

type Tab = 'following' | 'followers' | 'suggested';

export function Friends() {
  const { back } = useNav();
  const [tab, setTab] = useState<Tab>('following');
  const [openName, setOpenName] = useState<string | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(() => new Set(INITIAL_FOLLOWED));

  const toggle = (name: string) =>
    setFollowed((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  const list = FRIENDS.filter((u) => {
    if (tab === 'following') return followed.has(u.name);
    if (tab === 'followers') return u.rel === 'follower' || followed.has(u.name);
    return u.rel === 'suggested';
  });

  const counts = {
    following: FRIENDS.filter((u) => followed.has(u.name)).length,
    followers: FRIENDS.filter((u) => u.rel === 'follower' || followed.has(u.name)).length,
    suggested: FRIENDS.filter((u) => u.rel === 'suggested').length,
  };

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Naturalists</Text>
          <Text style={styles.sub}>People you follow · their bugs</Text>
        </View>
        <IconBtn fs={14}>🔍</IconBtn>
      </View>

      <View style={styles.tabs}>
        {(['following', 'followers', 'suggested'] as Tab[]).map((id) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[
              styles.tab,
              { backgroundColor: tab === id ? PB.ink : PB.cream2, shadowOpacity: tab === id ? 1 : 0 },
            ]}
          >
            <Text style={[styles.tabText, { color: tab === id ? PB.yellow : PB.ink }]}>
              {id === 'following' ? 'Following' : id === 'followers' ? 'Followers' : 'Suggested'}{' '}
              <Text style={{ opacity: 0.65 }}>· {counts[id]}</Text>
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {list.map((u) => {
          const isFollowed = followed.has(u.name);
          return (
            <Pressable
              key={u.name}
              onPress={() => setOpenName(u.name)}
              style={styles.row}
            >
              <View style={[styles.avatar, { backgroundColor: u.color }]}>
                <Text style={{ fontSize: 22 }}>{u.emoji}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text numberOfLines={1} style={styles.name}>{u.name}</Text>
                  <Text style={styles.country}>· {u.country}</Text>
                </View>
                {tab === 'suggested' ? (
                  <Text style={styles.why}>{u.why}</Text>
                ) : (
                  <View style={styles.lastRow}>
                    <Text style={{ fontSize: 12 }}>{u.catchEmoji}</Text>
                    <Text style={styles.last}>{u.last}</Text>
                    <Text style={styles.when}>· {u.when} ago</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>
                    #{u.rank}
                    {u.delta && u.delta !== '+0' ? (
                      <Text style={{ color: u.delta.startsWith('+') ? PB.green : PB.red }}>
                        {' '}{u.delta.startsWith('+') ? '↑' : '↓'}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggle(u.name)}
                  style={[
                    styles.followBtn,
                    { backgroundColor: isFollowed ? PB.cream : PB.green },
                  ]}
                >
                  <Text style={[styles.followText, { color: isFollowed ? PB.ink : PB.cream }]}>
                    {isFollowed ? '✓ Following' : '+ Follow'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}

        {list.length === 0 && (
          <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 24, padding: 18, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>🐜</Text>
            <Text style={styles.emptyTitle}>No one here yet.</Text>
            <Text style={styles.emptySub}>Check the Suggested tab to find naturalists like you.</Text>
          </Sticker>
        )}
      </ScrollView>

      <PersonModal
        name={openName}
        visible={!!openName}
        onClose={() => setOpenName(null)}
        isFollowed={openName ? followed.has(openName) : false}
        onToggleFollow={openName ? () => toggle(openName) : undefined}
        mutuals={openName && PERSON_PROFILES[openName] && followed.has(openName) ? 3 : openName ? 1 : 0}
      />
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
  tabs: { paddingHorizontal: 14, paddingTop: 10, flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  tabText: { fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 30, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2.5, height: 2.5 },
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '800', color: PB.ink, lineHeight: 15, flexShrink: 1 },
  country: { fontSize: 9, color: PB.ink, opacity: 0.55 },
  why: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 2 },
  lastRow: { flexDirection: 'row', gap: 8, marginTop: 3, alignItems: 'center' },
  last: { fontSize: 11, color: PB.ink, fontWeight: '700' },
  when: { fontSize: 10, color: PB.ink, opacity: 0.55 },
  rank: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 1.5,
    borderRadius: 99,
  },
  rankText: { fontSize: 10, fontWeight: '800', color: PB.ink, letterSpacing: 0.3 },
  followBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  followText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  emptyTitle: { marginTop: 6, fontSize: 16, fontWeight: '800', color: PB.ink },
  emptySub: { marginTop: 4, fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', textAlign: 'center' },
});
