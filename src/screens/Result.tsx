import * as Location from 'expo-location';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { BUGS, findBug } from '@/data/bugs';
import { useT, useBugName } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { usePersona } from '@/personas/hooks';
import { PB, RARITY_COLOR } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

/**
 * Per-bug fact list keyed by translation pack keys. Resolved on render so
 * a language flip refreshes the labels and the values (e.g. "Meadows"
 * vs. "Łąki") in the same pass.
 */
const FACT_KEYS: Record<string, Array<[string, string, string]>> = {
  mona: [
    ['facts.habitat',  'facts.values.meadows',      PB.green],
    ['facts.wingspan', 'facts.values.monaWingspan', PB.blue],
    ['facts.range',    'facts.values.naRange',      PB.purple],
    ['facts.diet',     'facts.values.milkweed',     PB.red],
  ],
  lhoc: [
    ['facts.habitat',  'facts.values.forests',      PB.green],
    ['facts.wingspan', 'facts.values.lhocWingspan', PB.blue],
    ['facts.range',    'facts.values.naEastRange',  PB.purple],
    ['facts.active',   'facts.values.nighttime',    PB.red],
  ],
  hcat: [
    ['facts.habitat',  'facts.values.hives',        PB.green],
    ['facts.wingspan', 'facts.values.hcatWingspan', PB.blue],
    ['facts.range',    'facts.values.worldwide',    PB.purple],
    ['facts.diet',     'facts.values.nectar',       PB.red],
  ],
};

const DEFAULT_FACT_KEYS: Array<[string, string, string]> = [
  ['facts.habitat', 'facts.various', PB.green],
  ['facts.size',    'facts.unknown', PB.blue],
  ['facts.range',   'facts.unknown', PB.purple],
  ['facts.diet',    'facts.unknown', PB.red],
];

export function Result() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const catchBug = useAppStore((s) => s.catchBug);
  const showToast = useAppStore((s) => s.showToast);
  const dex = useAppStore((s) => s.dex);
  const locationShareOn = useAppStore((s) => s.profile.locationShareOn);
  const route = useCurrentRoute();
  const params = route.params as { id?: string; photoUri?: string } | undefined;
  const id = params?.id ?? 'mona';
  const photoUri = params?.photoUri ?? null;
  const bug = findBug(id) ?? BUGS[0];
  const t = useT();
  const localizedName = useBugName(bug?.id ?? 'mona');
  if (!bug) return null;

  const P = usePersona(persona);
  const alreadyCaught = dex.has(bug.id);
  const conf = bug.rarity === 'legendary' ? 88 : bug.rarity === 'common' ? 98 : 94;
  const facts = FACT_KEYS[bug.id] ?? DEFAULT_FACT_KEYS;

  const snarkLine = bug.rarity === 'legendary'
    ? P.lines.legendary(localizedName)
    : P.lines.common(localizedName);

  const bg =
    bug.rarity === 'legendary' ? PB.purple : bug.rarity === 'epic' ? PB.pink : PB.orange;

  const onAdd = () => {
    if (alreadyCaught) {
      go('dex');
      return;
    }
    haptics.success();
    showToast({
      text: t('result.caughtToast', { xp: bug.xp, tier: bug.tier }),
      icon: bug.emoji,
      bg: PB.green,
    });
    setTimeout(() => go('dex'), 900);

    // Capture coords in the background — never block the catch on a
    // slow GPS fix. The store mutation lands immediately with the photo;
    // when the location resolves we file a single follow-up edit via a
    // second catchBug-shaped path? No — better: fire-and-forget the
    // location read and pass coords to catchBug only after it lands.
    // To avoid two store writes, we stage the catch atomically once
    // the position is in (with a short timeout fallback for refusal).
    const finalize = (coords?: { lat: number; lng: number }) => {
      catchBug(bug.id, {
        ...(photoUri ? { photoUri } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
    };

    if (!locationShareOn) {
      finalize();
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      finalize();
    }, 2500);

    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        finalize({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        finalize();
      });
  };

  const titleColor = bug.rarity === 'legendary' ? PB.cream : PB.ink;
  const personaShort = P.name.split(' ').pop()?.toUpperCase() ?? '';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={[styles.headTitle, { color: titleColor }]}>{t('result.headTitle')}</Text>
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
                {bug.tier} {t(`dex.filter.${bug.rarity}`).toUpperCase()}
              </Text>
            </View>
            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>+{bug.xp} XP</Text>
            </View>
          </View>
          <View style={{ padding: 14 }}>
            <Text style={styles.bugName}>{localizedName}</Text>
            <Text style={styles.bugLatin}>{bug.latin}</Text>
            <View style={styles.confRow}>
              <Text style={styles.confLabel}>{t('result.confidence')}</Text>
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
          onPress={() => go('chat', { topic: localizedName })}
        >
          <View style={styles.snarkRow}>
            <View style={[styles.snarkAvatar, { backgroundColor: PB.cream }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.snarkLine}>{snarkLine}</Text>
              <Text style={styles.snarkCta}>{t('result.askCta', { name: personaShort })}</Text>
            </View>
          </View>
        </Sticker>

        <View style={styles.factGrid}>
          {facts.map(([labelKey, valueKey, c]) => (
            <View key={labelKey} style={styles.factTile}>
              <Text style={[styles.factLabel, { color: c }]}>{t(labelKey).toUpperCase()}</Text>
              <Text style={styles.factValue}>{t(valueKey)}</Text>
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
            {alreadyCaught ? t('result.alreadyInDex') : t('result.addToDex')}
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
