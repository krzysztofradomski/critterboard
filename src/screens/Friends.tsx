import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFriends, useToggleFollow } from '@/backend/hooks';
import type { FriendScope } from '@/backend';
import { IconBtn } from '@/components/IconBtn';
import { PersonModal } from '@/components/PersonModal';
import { Sticker } from '@/components/Sticker';
import { PERSON_PROFILES, friendWhyKey, type FriendWhyKey } from '@/data/personProfiles';
import { bugName, useT } from '@/i18n/helpers';
import { countryName } from '@/i18n/helpers';
import { useAppStore } from '@/store/useAppStore';
import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';

type Tab = FriendScope;

/**
 * Adapter-row fields aren't 1:1 with the legacy display strings (`when`
 * is now `lastCatch.at`, the suggestion `whyKey` lives in
 * `reason.kind`). Resolve to translation-key shims at render time.
 */
const REASON_TO_WHY_KEY: Record<string, FriendWhyKey> = {
  sharedBugs: 'sharedBugs',
  nearby: 'brooklyn',
  viaFriend: 'viaMothwhisperer',
};

/**
 * Compact "2 hr" / "18 m" / "1 d" label for the last-catch snippet.
 * Wrapped by the `friends.ago` template (kept English-shaped to match
 * the legacy seed data — full localization is in `lib/timeAgo`).
 */
function formatAgo(deltaMs: number): string {
  const min = Math.floor(deltaMs / 60_000);
  if (min < 60) return `${Math.max(1, min)} m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr`;
  return `${Math.floor(hr / 24)} d`;
}

export function Friends() {
  const { back } = useNav();
  const t = useT();
  const language = useAppStore((s) => s.language);
  const followed = useAppStore((s) => s.followed);
  // Backend-aware toggle: updates the local persisted set *and* notifies
  // the server (no-op in mock today).
  const toggleFollow = useToggleFollow();
  const [tab, setTab] = useState<Tab>('following');
  const [openName, setOpenName] = useState<string | null>(null);

  const { data: page } = useFriends(tab);
  const list = page?.entries ?? [];

  // Count badges in the tabs need to reflect *all three* scopes
  // simultaneously — but we only fetched one. Cheap workaround: fall
  // back to local cardinality for the inactive tabs.
  const counts = {
    following: tab === 'following' ? list.length : followed.size,
    followers: tab === 'followers' ? list.length : followed.size,
    suggested: tab === 'suggested' ? list.length : (page?.totalCount ?? 0),
  };

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('friends.title')}</Text>
          <Text style={styles.sub}>{t('friends.sub')}</Text>
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
              {t(`friends.tab.${id}`)}{' '}
              <Text style={{ opacity: 0.65 }}>· {counts[id]}</Text>
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {list.map((u) => {
          const isFollowed = followed.has(u.userId);
          const whyKey = u.reason ? REASON_TO_WHY_KEY[u.reason.kind] : undefined;
          // Render the last-catch snippet from the live bug catalogue
          // (localized via the existing `bugName` helper) rather than
          // the legacy hand-curated `person.friend.*` strings.
          const lastBugName = u.lastCatch ? bugName(language, u.lastCatch.bugId) : '';
          const when = u.lastCatch
            ? formatAgo(Date.now() - u.lastCatch.at)
            : '';
          const delta = u.rankDelta;
          return (
            <Pressable
              key={u.userId}
              onPress={() => setOpenName(u.displayName)}
              style={styles.row}
            >
              <View style={[styles.avatar, { backgroundColor: u.avatarColor ?? PB.cream2 }]}>
                <Text style={{ fontSize: 22 }}>{u.avatarEmoji ?? '🐛'}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text numberOfLines={1} style={styles.name}>{u.displayName}</Text>
                  <Text style={styles.country}>· {countryName(language, u.country ?? 'private')}</Text>
                </View>
                {tab === 'suggested' ? (
                  <Text style={styles.why}>{whyKey ? t(friendWhyKey(whyKey)) : ''}</Text>
                ) : (
                  <View style={styles.lastRow}>
                    <Text style={{ fontSize: 12 }}>{u.lastCatch?.emoji ?? '🐛'}</Text>
                    <Text style={styles.last}>{lastBugName}</Text>
                    <Text style={styles.when}>· {t('friends.ago', { when })}</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={styles.rank}>
                  <Text style={styles.rankText}>
                    #{u.rank ?? '—'}
                    {delta != null && delta !== 0 ? (
                      <Text style={{ color: delta < 0 ? PB.green : PB.red }}>
                        {' '}{delta < 0 ? '↑' : '↓'}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggleFollow(u.userId)}
                  style={[
                    styles.followBtn,
                    { backgroundColor: isFollowed ? PB.cream : PB.green },
                  ]}
                >
                  <Text style={[styles.followText, { color: isFollowed ? PB.ink : PB.cream }]}>
                    {isFollowed ? t('friends.following') : t('friends.follow')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}

        {list.length === 0 && (
          <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 24, padding: 18, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>🐜</Text>
            <Text style={styles.emptyTitle}>{t('friends.emptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('friends.emptySub')}</Text>
          </Sticker>
        )}
      </ScrollView>

      <PersonModal
        name={openName}
        visible={!!openName}
        onClose={() => setOpenName(null)}
        isFollowed={openName ? followed.has(openName) : false}
        onToggleFollow={openName ? () => toggleFollow(openName) : undefined}
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
