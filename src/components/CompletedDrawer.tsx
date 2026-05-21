import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import type { CompletedQuest } from '@/data/quests';
import { useAppStore } from '@/store/useAppStore';

/**
 * Localized short date (`Apr 12` in en, `12 abr` in es). The pack lang
 * IDs already align with BCP-47 root codes so we pass them straight to
 * `Intl.DateTimeFormat`.
 */
function formatShortDate(at: number, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(new Date(at));
  } catch {
    return new Date(at).toDateString();
  }
}

export function CompletedDrawer({
  open,
  onToggle,
  items,
}: {
  open: boolean;
  onToggle: () => void;
  items: CompletedQuest[];
}) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const totalXp = items.reduce((s, i) => s + i.reward, 0);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        style={[styles.header, { backgroundColor: open ? PB.cream2 : PB.paper }]}
      >
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>✓</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>{t('quests.completed')}</Text>
          <Text style={styles.headerSub}>
            {t('quests.completedSub', { n: items.length, xp: totalXp.toLocaleString() })}
          </Text>
        </View>
        <View style={styles.chev}>
          <Text style={[styles.chevText, { transform: [{ rotate: open ? '180deg' : '0deg' }] }]}>⌄</Text>
        </View>
      </Pressable>
      {open && (
        <View style={styles.list}>
          {items.map((it) => {
            const isReal = it.completedAt !== undefined;
            const label = isReal
              ? t(`quests.labels.${it.id}`)
              : t(`quests.completedLabels.${it.id}`);
            const date = isReal
              ? formatShortDate(it.completedAt!, lang)
              : t(`quests.completedDates.${it.id}`);
            return (
              <View key={it.id} style={styles.item}>
                <View
                  style={[
                    styles.itemIcon,
                    { backgroundColor: it.kind === 'weekly' ? PB.purple : PB.green },
                  ]}
                >
                  <Text style={styles.itemIconText}>{it.icon}</Text>
                </View>
                <View style={styles.itemBody}>
                  <Text numberOfLines={1} style={styles.itemTitle}>
                    {label}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {date} · {t(`quests.kind${it.kind === 'weekly' ? 'Weekly' : 'Daily'}`)}
                  </Text>
                </View>
                <View style={styles.itemReward}>
                  <Text style={styles.itemRewardText}>+{it.reward}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 16,
    backgroundColor: PB.paper,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { color: PB.cream, fontSize: 16, fontWeight: '800' },
  headerBody: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '800', color: PB.ink, letterSpacing: 0.4 },
  headerSub: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 1 },
  chev: {
    width: 28,
    height: 28,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevText: { fontSize: 14, fontWeight: '800', color: PB.ink },
  list: { padding: 10, gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: { fontSize: 16 },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 14 },
  itemMeta: { fontSize: 10, color: PB.ink, opacity: 0.6, marginTop: 2 },
  itemReward: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  itemRewardText: { fontSize: 11, fontWeight: '800', color: PB.ink },
});
