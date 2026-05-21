import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sticker } from '@/components/Sticker';
import { TabBar } from '@/components/TabBar';
import { BUGS } from '@/data/bugs';
import { useT, bugName } from '@/i18n/helpers';
import { latestPhotoFor } from '@/lib/streak';
import { PB, RARITY_COLOR } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const FILTER_KEYS = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function Dex() {
  const { go } = useNav();
  const dex = useAppStore((s) => s.dex);
  const catchLog = useAppStore((s) => s.catchLog);
  const language = useAppStore((s) => s.language);
  const t = useT();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUGS.filter((b) => {
      if (filter !== 'all' && b.rarity !== filter) return false;
      if (!q) return true;
      if (dex.has(b.id)) {
        return (
          bugName(language, b.id).toLowerCase().includes(q) ||
          b.latin.toLowerCase().includes(q) ||
          b.rarity.includes(q)
        );
      }
      if (q.startsWith('?')) {
        const n = q.slice(1).replace(/^0+/, '');
        const idx = String(BUGS.indexOf(b) + 1);
        return idx === n || idx.endsWith(n);
      }
      return false;
    });
  }, [filter, query, dex, language]);

  const total = BUGS.length;
  const caught = dex.size;
  const pct = Math.round((100 * caught) / total);
  const rarities = FILTER_KEYS.slice(1).map((k) => t(`dex.filter.${k}`).toLowerCase()).join(', ');

  // Celebratory ribbon at 50 % and 100 %. The 100 % case wins over 50 %
  // — once the dex is full we never re-show the halfway line.
  const ribbon: { key: 'full' | 'half'; bg: string; rotate: number } | null =
    caught === total
      ? { key: 'full', bg: PB.yellow, rotate: -2 }
      : pct >= 50
        ? { key: 'half', bg: PB.purple, rotate: 1.5 }
        : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headTop}>
          <View>
            <Text style={styles.title}>{t('dex.title')}</Text>
            <Text style={styles.sub}>{t('dex.caughtOf', { caught, total })}</Text>
          </View>
          <View style={styles.pctBubble}>
            <Text style={styles.pctText}>{pct}%</Text>
          </View>
        </View>
        <View style={styles.progressShell}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('dex.searchPlaceholder')}
              placeholderTextColor={PB.ink + '99'}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {FILTER_KEYS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setFilter(c)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === c ? PB.yellow : PB.cream,
                  shadowOpacity: filter === c ? 1 : 0,
                },
              ]}
            >
              <Text style={styles.filterText}>{t(`dex.filter.${c}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.list}>
        {ribbon && (
          <Sticker
            bg={ribbon.bg}
            rotate={ribbon.rotate}
            style={{ paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 }}
          >
            <View style={styles.ribbonRow}>
              <Text style={styles.ribbonIcon}>{ribbon.key === 'full' ? '🏆' : '✨'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.ribbonTitle}>
                  {t(`dex.ribbon.${ribbon.key}Title`)}
                </Text>
                <Text style={styles.ribbonSub}>
                  {t(`dex.ribbon.${ribbon.key}Sub`, { caught, total })}
                </Text>
              </View>
            </View>
          </Sticker>
        )}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🪰</Text>
            <Text style={styles.emptyTitle}>{t('dex.emptyTitle', { query })}</Text>
            <Text style={styles.emptyDesc}>{t('dex.emptyDesc', { rarities })}</Text>
            <Text style={styles.emptyHint}>{t('dex.emptyHint')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid}>
            {filtered.map((b) => {
              const isCaught = dex.has(b.id);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    if (!isCaught) return;
                    const photoUri = latestPhotoFor(catchLog, b.id);
                    go('result', photoUri ? { id: b.id, photoUri } : { id: b.id });
                  }}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isCaught ? PB.paper : PB.cream2,
                      opacity: isCaught ? 1 : 0.65,
                    },
                  ]}
                >
                  <View style={[styles.tierPill, { backgroundColor: RARITY_COLOR[b.rarity] }]}>
                    <Text style={styles.tierText}>{b.tier}</Text>
                  </View>
                  <View
                    style={[
                      styles.cellArt,
                      { backgroundColor: isCaught ? '#fff' : PB.cream2 },
                    ]}
                  >
                    <Text style={[styles.cellEmoji, !isCaught && { opacity: 0.3 }]}>
                      {b.emoji}
                    </Text>
                  </View>
                  <Text style={styles.cellName}>
                    {isCaught ? bugName(language, b.id) : t('dex.uncaughtName')}
                  </Text>
                  <Text style={styles.cellId}>#{String(BUGS.indexOf(b) + 1).padStart(3, '0')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <TabBar active="dex" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.green, paddingTop: 50 },
  header: { padding: 16, paddingTop: 12, paddingBottom: 14 },
  headTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: PB.cream, lineHeight: 30 },
  sub: { fontSize: 13, color: PB.cream, opacity: 0.85, fontWeight: '600', marginTop: 4 },
  pctBubble: {
    width: 56,
    height: 56,
    borderRadius: 99,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2.5,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: { fontSize: 16, fontWeight: '800', color: PB.ink },
  progressShell: {
    marginTop: 12,
    height: 16,
    backgroundColor: PB.ink,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 99,
    padding: 2,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  progressFill: { height: '100%', backgroundColor: PB.yellow, borderRadius: 99 },
  searchRow: { marginTop: 14 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  searchInput: { flex: 1, height: '100%', fontSize: 13, color: PB.ink, fontWeight: '600' },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 11, fontWeight: '800', color: PB.ink },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  filterText: { fontSize: 12, fontWeight: '700', color: PB.ink },
  list: {
    flex: 1,
    backgroundColor: PB.cream,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    padding: 14,
    marginBottom: 100,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: {
    width: '47%',
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 16,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    padding: 10,
    position: 'relative',
  },
  tierPill: {
    position: 'absolute',
    top: -8,
    right: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  tierText: { fontSize: 9, fontWeight: '800', color: PB.ink, letterSpacing: 0.5 },
  cellArt: {
    height: 80,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmoji: { fontSize: 38 },
  cellName: { marginTop: 8, fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 14 },
  cellId: { marginTop: 2, fontSize: 10, color: PB.ink, opacity: 0.55 },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { marginTop: 8, fontSize: 18, fontWeight: '800', color: PB.ink },
  emptyDesc: { marginTop: 4, fontSize: 13, color: PB.ink, opacity: 0.7, fontWeight: '600', textAlign: 'center' },
  emptyHint: { marginTop: 10, fontSize: 10, color: PB.ink, opacity: 0.55, textAlign: 'center' },
  ribbonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ribbonIcon: { fontSize: 28 },
  ribbonTitle: { fontSize: 14, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  ribbonSub: { fontSize: 11, color: PB.cream, opacity: 0.9, marginTop: 2, fontWeight: '600' },
});
