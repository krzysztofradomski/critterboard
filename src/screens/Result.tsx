import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { BUGS, findBug } from '@/data/bugs';
import { haptics } from '@/lib/haptics';
import { PERSONAS } from '@/personas';
import { PB, RARITY_COLOR } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const FACT_TABLE: Record<string, Array<[string, string, string]>> = {
  mona: [['Habitat', 'Meadows', PB.green], ['Wingspan', '8.9–10.2 cm', PB.blue], ['Range', 'N. America', PB.purple], ['Diet', 'Milkweed', PB.red]],
  lhoc: [['Habitat', 'Forests', PB.green], ['Wingspan', '10–11 cm', PB.blue], ['Range', 'E. N. America', PB.purple], ['Active', 'Nighttime', PB.red]],
  hcat: [['Habitat', 'Hives', PB.green], ['Wingspan', '1.2 cm', PB.blue], ['Range', 'Worldwide', PB.purple], ['Diet', 'Nectar', PB.red]],
};

const DEFAULT_FACTS: Array<[string, string, string]> = [
  ['Habitat', 'Various', PB.green],
  ['Size', '—', PB.blue],
  ['Range', '—', PB.purple],
  ['Diet', '—', PB.red],
];

export function Result() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const catchBug = useAppStore((s) => s.catchBug);
  const showToast = useAppStore((s) => s.showToast);
  const dex = useAppStore((s) => s.dex);
  const route = useCurrentRoute();
  const params = route.params as { id?: string; photoUri?: string } | undefined;
  const id = params?.id ?? 'mona';
  const photoUri = params?.photoUri ?? null;
  const bug = findBug(id) ?? BUGS[0];
  if (!bug) return null;

  const P = PERSONAS[persona];
  const alreadyCaught = dex.has(bug.id);
  const conf = bug.rarity === 'legendary' ? 88 : bug.rarity === 'common' ? 98 : 94;
  const facts = FACT_TABLE[bug.id] ?? DEFAULT_FACTS;

  const snarkLine = bug.rarity === 'legendary' ? P.lines.legendary(bug.name) : P.lines.common(bug.name);

  const bg =
    bug.rarity === 'legendary' ? PB.purple : bug.rarity === 'epic' ? PB.pink : PB.orange;

  const onAdd = () => {
    if (alreadyCaught) {
      go('dex');
      return;
    }
    catchBug(bug.id);
    haptics.success();
    showToast({ text: `Caught! +${bug.xp} XP · ${bug.tier}`, icon: bug.emoji, bg: PB.green });
    setTimeout(() => go('dex'), 900);
  };

  const titleColor = bug.rarity === 'legendary' ? PB.cream : PB.ink;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={[styles.headTitle, { color: titleColor }]}>IDENTIFIED!</Text>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.cream} rotate={-1} style={styles.heroSticker}>
          <View style={styles.heroImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.heroPhoto} resizeMode="cover" />
            ) : (
              <CameraScene dark={false} />
            )}
            <View style={[styles.tierBadge, { backgroundColor: RARITY_COLOR[bug.rarity] }]}>
              <Text style={styles.tierText}>
                {bug.tier} {bug.rarity.toUpperCase()}
              </Text>
            </View>
            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>+{bug.xp} XP</Text>
            </View>
          </View>
          <View style={{ padding: 14 }}>
            <Text style={styles.bugName}>{bug.name}</Text>
            <Text style={styles.bugLatin}>{bug.latin}</Text>
            <View style={styles.confRow}>
              <Text style={styles.confLabel}>CONFIDENCE</Text>
              <Text style={[styles.confValue, { color: PB.green }]}>{conf}%</Text>
            </View>
            <View style={styles.confBar}>
              <View style={[styles.confFill, { width: `${conf}%` }]} />
            </View>
          </View>
        </Sticker>

        <Sticker
          bg={P.cardBg}
          rotate={1.5}
          style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
          onPress={() => go('chat', { topic: bug.name })}
        >
          <View style={styles.snarkRow}>
            <View style={[styles.snarkAvatar, { backgroundColor: PB.cream }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.snarkLine}>{snarkLine}</Text>
              <Text style={styles.snarkCta}>ASK {P.name.split(' ').pop()?.toUpperCase()} →</Text>
            </View>
          </View>
        </Sticker>

        <View style={styles.factGrid}>
          {facts.map(([k, v, c]) => (
            <View key={k} style={styles.factTile}>
              <Text style={[styles.factLabel, { color: c }]}>{k.toUpperCase()}</Text>
              <Text style={styles.factValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 14 }}>
          <Btn
            full
            bg={alreadyCaught ? PB.cream : PB.ink}
            color={alreadyCaught ? PB.ink : PB.yellow}
            size="lg"
            onPress={onAdd}
          >
            {alreadyCaught ? 'Already in your Dex ✓' : 'Add to Dex 📔'}
          </Btn>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, paddingTop: 50, paddingBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headTitle: { fontSize: 16, fontWeight: '800' },
  scroll: { paddingVertical: 12, paddingHorizontal: 14 },
  heroSticker: { padding: 0, overflow: 'hidden' },
  heroImage: { height: 200, position: 'relative', backgroundColor: '#fff', overflow: 'hidden' },
  heroPhoto: { ...StyleSheet.absoluteFillObject },
  tierBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  tierText: { fontSize: 11, fontWeight: '800', color: PB.ink },
  xpBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.green,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  xpText: { fontSize: 11, fontWeight: '800', color: PB.cream },
  bugName: { fontSize: 28, fontWeight: '800', color: PB.ink, lineHeight: 28 },
  bugLatin: { fontSize: 13, color: PB.ink, opacity: 0.6, marginTop: 4, fontStyle: 'italic' },
  confRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  confLabel: { fontSize: 11, fontWeight: '800', color: PB.ink, letterSpacing: 0.5 },
  confValue: { fontSize: 18, fontWeight: '800' },
  confBar: {
    marginTop: 6,
    height: 14,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    overflow: 'hidden',
  },
  confFill: { height: '100%', backgroundColor: PB.green, borderRightColor: PB.ink, borderRightWidth: 2 },
  snarkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  snarkAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snarkLine: { fontSize: 14, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  snarkCta: { marginTop: 4, fontSize: 10, fontWeight: '800', color: PB.ink, opacity: 0.7 },
  factGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  factTile: {
    width: '47%',
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    padding: 10,
  },
  factLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  factValue: { fontSize: 16, fontWeight: '800', color: PB.ink, marginTop: 2 },
});
