import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFriends, useToggleFollow } from '@/backend/hooks';
import type { FriendScope } from '@/backend';
import { PersonModal } from '@/components/PersonModal';
import { PERSON_PROFILES, friendWhyKey, type FriendWhyKey } from '@/data/personProfiles';
import { bugName, countryName, useT } from '@/i18n/helpers';
import { timeAgo } from '@/lib/timeAgo';
import { useAppStore } from '@/store/useAppStore';
import { PB } from '@/tokens/pb';
import { haptics } from '@/lib/haptics';

const SCOPES: FriendScope[] = ['following', 'followers', 'suggested'];

/** Why a suggestion was made → the `person.why.*` translation key. */
const REASON_TO_WHY_KEY: Record<string, FriendWhyKey> = {
  sharedBugs: 'sharedBugs',
  nearby: 'brooklyn',
  viaFriend: 'viaMothwhisperer',
};

/**
 * The Friends tab of the Ranks screen. It lives *inside* the Ranks sheet, so
 * the Me tabs, the Global/Weekly/Friends strip and the bottom bar stay put,
 * and its rows share the leaderboard's row design.
 */
export function FriendsPanel() {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const followed = useAppStore((s) => s.followed);
  const toggleFollow = useToggleFollow();
  const [scope, setScope] = useState<FriendScope>('following');
  const [openName, setOpenName] = useState<string | null>(null);

  const { data: page } = useFriends(scope);
  const list = page?.entries ?? [];

  return (
    <View>
      <View style={styles.chips}>
        {SCOPES.map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              haptics.select();
              setScope(id);
            }}
            style={[styles.chip, { backgroundColor: scope === id ? PB.ink : PB.cream2 }]}
          >
            <Text style={[styles.chipText, { color: scope === id ? PB.yellow : PB.ink }]}>
              {t(`friends.tab.${id}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View>
        {list.map((u) => {
          const isFollowed = followed.has(u.userId);
          const whyKey = u.reason ? REASON_TO_WHY_KEY[u.reason.kind] : undefined;
          const meta =
            scope === 'suggested' && whyKey
              ? t(friendWhyKey(whyKey))
              : u.lastCatch
                ? `${bugName(language, u.lastCatch.bugId)} · ${timeAgo(u.lastCatch.at, language)}`
                : countryName(language, u.country ?? 'private');
          return (
            <Pressable
              key={u.userId}
              onPress={() => setOpenName(u.displayName)}
              style={[styles.row, { backgroundColor: PB.paper }]}
            >
              <View style={styles.avatar}>
                <Text>{u.avatarEmoji ?? '🐛'}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={styles.name}>{u.displayName}</Text>
                <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
              </View>
              <Pressable
                onPress={() => toggleFollow(u.userId)}
                style={[styles.followBtn, { backgroundColor: isFollowed ? PB.cream : PB.green }]}
              >
                <Text style={[styles.followText, { color: isFollowed ? PB.ink : PB.cream }]}>
                  {isFollowed ? t('friends.following') : t('friends.follow')}
                </Text>
              </Pressable>
            </Pressable>
          );
        })}

        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 22 }}>🐜</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.emptyTitle}>{t('friends.emptyTitle')}</Text>
              <Text style={styles.emptySub}>{t('friends.emptySub')}</Text>
            </View>
          </View>
        )}
      </View>

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
  chips: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  chip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  chipText: { fontSize: 12, fontWeight: '800' },
  // Same shape as the leaderboard rows.
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
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: PB.ink },
  emptySub: { fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 2 },
});
