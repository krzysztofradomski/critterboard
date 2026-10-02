import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BugIcon } from '@/components/BugIcon';
import { Sticker } from '@/components/Sticker';
import { TabBar } from '@/components/TabBar';
import type { Bug } from '@/data/bugs';
import { useT, bugName } from '@/i18n/helpers';
import { latestPhotoFor } from '@/lib/streak';
import { useBugs } from '@/lib/useBugs';
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
  // Bundled + installed pack species (1,000 with the eu-ce pack).
  const bugs = useBugs();
  // Dex number (#001…) = position in the registry; a map keeps lookups O(1).
  const numberOf = useMemo(() => new Map(bugs.map((b, i) => [b.id, i + 1])), [bugs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = bugs.filter((b) => {
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
        const idx = String(numberOf.get(b.id));
        return idx === n || idx.endsWith(n);
      }
      return false;
    });
    // Caught species first so they aren't buried among hundreds of "???"
    // cells; stable sort keeps dex-number order within each group.
    return matches.sort((a, b) => Number(dex.has(b.id)) - Number(dex.has(a.id)));
  }, [bugs, numberOf, filter, query, dex, language]);

  const total = bugs.length;
  // Only count catches of species that are listed (a removed pack's species
  // would otherwise push this past the total).
  const caught = useMemo(() => bugs.reduce((n, b) => n + (dex.has(b.id) ? 1 : 0), 0), [bugs, dex]);
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

  const renderCell = useCallback(
    ({ item: b }: { item: Bug }) => {
      const isCaught = dex.has(b.id);
      return (
        <Pressable
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
          <View style={[styles.cellArt, { backgroundColor: isCaught ? '#fff' : PB.cream2 }]}>
            <BugIcon bug={b} size={70} silhouette={!isCaught} />
          </View>
          <Text style={styles.cellName} numberOfLines={2}>
            {isCaught ? bugName(language, b.id) : t('dex.uncaughtName')}
          </Text>
          <Text style={styles.cellId}>#{String(numberOf.get(b.id)).padStart(3, '0')}</Text>
        </Pressable>
      );
    },
    [dex, catchLog, go, language, t, numberOf],
  );

  const header = (
    <View>
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
    </View>
  );

  const emptyEl = (
          <View style={styles.empty}>
            <Text style={{ fontSize: 56 }}>🪰</Text>
            <Text style={styles.emptyTitle}>{t('dex.emptyTitle', { query })}</Text>
            <Text style={styles.emptyDesc}>{t('dex.emptyDesc', { rarities })}</Text>
            <Text style={styles.emptyHint}>{t('dex.emptyHint')}</Text>
          </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        numColumns={2}
        renderItem={renderCell}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyEl}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews
      />

      <TabBar active="dex" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: PB.cream },
  header: {
    padding: 16,
    marginBottom: 14,
    backgroundColor: PB.green,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 20,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
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
  // paddingTop leaves room for the first row's tier pills (top: -8).
  // Whole page scrolls beneath the status bar and the floating tab bar.
  grid: { paddingTop: 56, paddingHorizontal: 14, paddingBottom: 130, gap: 14 },
  gridRow: { justifyContent: 'space-between' },
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
