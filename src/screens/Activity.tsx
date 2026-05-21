import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFeed } from '@/backend/hooks';
import type { FeedEvent } from '@/backend';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { findBug } from '@/data/bugs';
import { bugName, useT } from '@/i18n/helpers';
import { timeAgo } from '@/lib/timeAgo';
import { PERSONA_META } from '@/personas';
import { PB } from '@/tokens/pb';
import { useAppStore, type ActivityEntry } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

/**
 * UI bucket maps onto the entry kind:
 *   - 'social' = catches + streak milestones (things the user did)
 *   - 'system' = persona switches (things the app reacted to)
 *
 * The original prototype had richer "system" content (model updates,
 * pack syncs); those land here automatically once the store grows
 * the matching action types.
 */
type UiKind = 'social' | 'system';
type Tab = 'all' | UiKind | 'friends';

function uiKindOf(entry: ActivityEntry): UiKind {
  return entry.kind === 'persona' ? 'system' : 'social';
}

type Resolved = {
  /** Stable list key. */
  id: string;
  emoji: string;
  color: string;
  photoUri?: string;
  title: string;
  sub: string;
  cta: string;
  onPress: () => void;
  uiKind: UiKind | 'friends';
};

type LangId = Parameters<typeof timeAgo>[1];
type TFn = (key: string, vars?: Record<string, string | number>) => string;
type GoFn = ReturnType<typeof useNav>['go'];

/**
 * Project a backend `FeedEvent` onto the same `Resolved` row shape the
 * local-activity stream uses. Keeps the list rendering branch-free at
 * the JSX layer.
 */
function resolveFeedEvent(
  ev: FeedEvent,
  language: LangId,
  t: TFn,
  go: GoFn,
): Resolved {
  const when = timeAgo(ev.at, language);
  const baseEmoji = ev.actor.avatarEmoji ?? '🐛';
  const baseColor = PB.cream2;
  const profileGo = () => go('friends');

  if (ev.kind === 'catch') {
    const bug = findBug(ev.bugId);
    return {
      id: ev.id,
      emoji: bug?.emoji ?? baseEmoji,
      color: bug?.color ?? baseColor,
      title: t('activity.kind.friendCatchTitle', {
        name: ev.actor.displayName,
        bug: bug ? bugName(language, bug.id) : ev.bugId,
      }),
      sub: t('activity.kind.friendCatchSub', { when }),
      cta: t('activity.kind.friendCta'),
      onPress: profileGo,
      uiKind: 'friends',
    };
  }
  if (ev.kind === 'streak') {
    return {
      id: ev.id,
      emoji: '🔥',
      color: PB.red,
      title: t('activity.kind.friendStreakTitle', {
        name: ev.actor.displayName,
        days: ev.days,
      }),
      sub: t('activity.kind.friendStreakSub', { when }),
      cta: t('activity.kind.friendCta'),
      onPress: profileGo,
      uiKind: 'friends',
    };
  }
  if (ev.kind === 'badge') {
    return {
      id: ev.id,
      emoji: '🏅',
      color: PB.yellow,
      title: t('activity.kind.friendBadgeTitle', { name: ev.actor.displayName }),
      sub: t('activity.kind.friendBadgeSub', { when }),
      cta: t('activity.kind.friendCta'),
      onPress: profileGo,
      uiKind: 'friends',
    };
  }
  if (ev.kind === 'rankUp') {
    return {
      id: ev.id,
      emoji: '📈',
      color: PB.green,
      title: t('activity.kind.friendRankUpTitle', {
        name: ev.actor.displayName,
        rank: ev.to,
      }),
      sub: t('activity.kind.friendRankUpSub', { when }),
      cta: t('activity.kind.friendCta'),
      onPress: () => go('leaderboard'),
      uiKind: 'friends',
    };
  }
  return {
    id: ev.id,
    emoji: baseEmoji,
    color: baseColor,
    title: t('activity.kind.friendFollowTitle', { name: ev.actor.displayName }),
    sub: t('activity.kind.friendFollowSub', { when }),
    cta: t('activity.kind.friendCta'),
    onPress: profileGo,
    uiKind: 'friends',
  };
}

export function Activity() {
  const { go, back } = useNav();
  const t = useT();
  const language = useAppStore((s) => s.language);
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const activityLog = useAppStore((s) => s.activityLog);
  const [tab, setTab] = useState<Tab>('all');

  // Backend-fed friend activity. Only queried when `networkOn` is on;
  // the hook returns an offline error otherwise and the screen renders
  // the dedicated empty state.
  const { data: feedPage } = useFeed();

  const localResolved: Resolved[] = useMemo(() => {
    return activityLog.map((entry) => {
      const when = timeAgo(entry.at, language);
      const uiKind = uiKindOf(entry);

      if (entry.kind === 'catch') {
        const bug = findBug(entry.bugId);
        const name = bug ? bugName(language, bug.id) : entry.bugId;
        const xp = bug?.xp ?? 0;
        const photoUri = entry.photoUri;
        return {
          id: entry.id,
          emoji: bug?.emoji ?? '🐛',
          color: bug?.color ?? PB.cream2,
          ...(photoUri ? { photoUri } : {}),
          title: t('activity.kind.catchTitle', { name }),
          sub: t('activity.kind.catchSub', { xp, when }),
          cta: t('activity.kind.catchCta'),
          onPress: () =>
            go('result', photoUri ? { id: entry.bugId, photoUri } : { id: entry.bugId }),
          uiKind,
        };
      }

      if (entry.kind === 'persona') {
        const meta = PERSONA_META[entry.personaId];
        const name = t(`personas.${entry.personaId}.name`);
        return {
          id: entry.id,
          emoji: meta.emoji,
          color: meta.avatarBg,
          title: t('activity.kind.personaTitle', { name }),
          sub: t('activity.kind.personaSub', { when }),
          cta: t('activity.kind.personaCta'),
          onPress: () => go('chat'),
          uiKind,
        };
      }

      return {
        id: entry.id,
        emoji: '🔥',
        color: PB.red,
        title: t('activity.kind.streakTitle', { days: entry.days }),
        sub: t('activity.kind.streakSub', { when }),
        cta: t('activity.kind.streakCta'),
        onPress: () => go('scan'),
        uiKind,
      };
    });
  }, [activityLog, language, t, go]);

  const friendResolved: Resolved[] = useMemo(() => {
    const events: FeedEvent[] = feedPage?.events ?? [];
    return events.map((ev) => resolveFeedEvent(ev, language, t, go));
  }, [feedPage, language, t, go]);

  const filtered =
    tab === 'all'
      ? localResolved
      : tab === 'friends'
        ? friendResolved
        : localResolved.filter((r) => r.uiKind === tab);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('activity.title')}</Text>
          <Text style={styles.sub}>{t('activity.sub', { n: activityLog.length })}</Text>
        </View>
        <IconBtn fs={14}>✓</IconBtn>
      </View>

      <View style={styles.tabs}>
        {(['all', 'social', 'system', 'friends'] as const).map((id) => (
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
              {t(`activity.tab.${id}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {tab === 'friends' && !networkOn && (
          <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 20, padding: 18, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>📡</Text>
            <Text style={styles.emptyTitle}>{t('activity.kind.feedOffline')}</Text>
          </Sticker>
        )}
        {filtered.map((r) => (
          <Pressable key={r.id} onPress={r.onPress} style={styles.row}>
            {r.photoUri ? (
              <View style={[styles.icon, { backgroundColor: r.color, overflow: 'hidden' }]}>
                <Image source={{ uri: r.photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              </View>
            ) : (
              <View style={[styles.icon, { backgroundColor: r.color }]}>
                <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowSub}>{r.sub}</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{r.cta} →</Text>
              </View>
            </View>
          </Pressable>
        ))}

        {filtered.length === 0 && (
          <Sticker bg={PB.cream2} rotate={-1} style={{ marginTop: 20, padding: 18, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>🦗</Text>
            <Text style={styles.emptyTitle}>{t('activity.emptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('activity.emptySub')}</Text>
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
  },
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
