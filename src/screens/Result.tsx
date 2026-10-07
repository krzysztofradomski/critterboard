import * as Location from 'expo-location';
import React from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { BugIcon } from '@/components/BugIcon';
import { Btn } from '@/components/Btn';
import { CatchPhoto } from '@/components/CatchPhoto';
import { IconBtn } from '@/components/IconBtn';
import {
  Section,
  SpeciesAbout,
  SpeciesBadges,
  SpeciesLifeCycle,
  SpeciesSeason,
  SpeciesSize,
} from '@/components/SpeciesSections';
import { Sticker } from '@/components/Sticker';
import { BUGS, findBug } from '@/data/bugs';
import { factTiles, orderKey } from '@/data/speciesFacts';
import { useT, useBugName } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { keepPhoto } from '@/lib/photos';
import { latestPhotoFor } from '@/lib/streak';
import { usePersona } from '@/personas/hooks';
import { PB, RARITY_COLOR } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';
import { useNearbySightings, usePublishCatch } from '@/backend/hooks';

export function Result() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const catchBug = useAppStore((s) => s.catchBug);
  const showToast = useAppStore((s) => s.showToast);
  const removeFromDex = useAppStore((s) => s.removeFromDex);
  const dex = useAppStore((s) => s.dex);
  const locationShareOn = useAppStore((s) => s.profile.locationShareOn);
  const minConfidence = useAppStore((s) => s.profile.minConfidence);
  const route = useCurrentRoute();
  const params = route.params as { id?: string; photoUri?: string; conf?: number } | undefined;
  const id = params?.id ?? 'mona';
  const photoUri = params?.photoUri ?? null;
  const bug = findBug(id) ?? BUGS[0];
  const t = useT();
  const localizedName = useBugName(bug?.id ?? 'lady');
  const catchLog = useAppStore((s) => s.catchLog);
  const nearby = useNearbySightings().filter((x) => x.bugId === id).length;
  if (!bug) return null;

  const publishCatch = usePublishCatch();
  const P = usePersona(persona);
  const alreadyCaught = dex.has(bug.id);
  // Only a fresh scan carries a model confidence; opening a bug from the Dex has none.
  const conf = params?.conf;
  const language = useAppStore((s) => s.language);
  const tiles = factTiles(bug, language, t);
  const order = orderKey(bug);
  // One catch per species (a re-scan doesn't add another): its date and, when known, its place.
  const myCatch = alreadyCaught ? catchLog.find((e) => e.id === bug.id) : undefined;
  // Opened from a map pin or a sighting there's no photo param; show and share the catch's own.
  const shownPhoto = photoUri ?? (alreadyCaught ? latestPhotoFor(catchLog, bug.id) ?? null : null);

  const share = () => {
    const message = t('result.shareText', { name: localizedName, latin: bug.latin, emoji: bug.emoji });
    // iOS shares the photo with the text; Android's share sheet takes text only.
    void Share.share(Platform.OS === 'ios' && shownPhoto ? { message, url: shownPhoto } : { message }).catch(() => undefined);
  };

  const snarkLine = bug.rarity === 'legendary'
    ? P.lines.legendary(localizedName)
    : P.lines.common(localizedName);

  const bg =
    bug.rarity === 'legendary' ? PB.purple : bug.rarity === 'epic' ? PB.pink : PB.orange;

  const onAdd = () => {
    // Defence in depth: the scanner already filters these out.
    if (conf !== undefined && conf < minConfidence) {
      haptics.warning();
      showToast({ text: t('result.tooUnsure', { min: minConfidence }), icon: '🤔', bg: PB.yellow });
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
    const finalize = async (coords?: { lat: number; lng: number }) => {
      const at = Date.now();
      // Out of the cache folder, which the OS may empty, so the Dex keeps the photo.
      const keptUri = photoUri ? await keepPhoto(photoUri) : null;
      catchBug(bug.id, {
        at,
        ...(keptUri ? { photoUri: keptUri } : {}),
        ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      });
      // Coordinates leave the device only for users who opted in to sharing.
      publishCatch(bug.id, at, locationShareOn ? coords?.lat : undefined, locationShareOn ? coords?.lng : undefined);
    };

    // The catch is pinned on the user's own (private) map whenever the OS
    // location permission is granted; coordinates are only *published*
    // when they opted in to sharing.
    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm?.granted) {
        void finalize();
        return;
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        void finalize();
      }, 2500);
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          void finalize({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          void finalize();
        });
    })();
  };

  const titleColor = bug.rarity === 'legendary' ? PB.cream : PB.ink;
  const personaShort = P.name.split(' ').pop()?.toUpperCase() ?? '';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={[styles.headTitle, { color: titleColor }]}>{t('result.headTitle')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.cream} rotate={-1} style={styles.heroSticker}>
          <View style={styles.heroImage}>
            {/* The photo, else the species' sticker icon (or its emoji when there is no icon). */}
            <CatchPhoto
              uri={shownPhoto}
              fallback={
                <View style={styles.heroIcon}>
                  <BugIcon bug={bug} size={168} />
                </View>
              }
            />
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
            {order && (
              <Text style={styles.taxon}>
                {t(order)}
                {bug.facts?.fa ? ` · ${bug.facts.fa}` : ''}
              </Text>
            )}
            {conf !== undefined && (
              <>
                <View style={styles.confRow}>
                  <Text style={styles.confLabel}>{t('result.confidence')}</Text>
                  <Text style={[styles.confValue, { color: PB.green }]}>{conf}%</Text>
                </View>
                <View style={styles.confBar}>
                  <View style={[styles.confFill, { width: `${conf}%` }]} />
                </View>
              </>
            )}
          </View>
        </Sticker>

        <SpeciesBadges bug={bug} />

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

        <SpeciesAbout bug={bug} lang={language} />

        {tiles && (
          <>
            <View style={styles.factGrid}>
              {tiles.map((tile) => (
                <View key={tile.label} style={styles.factTile}>
                  <Text style={[styles.factLabel, { color: tile.color }]}>{tile.label.toUpperCase()}</Text>
                  <Text style={styles.factValue}>{tile.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.familyNote}>{t('facts.familyNote')}</Text>
          </>
        )}

        {myCatch && (
          <Section title={t('result.yourCatch')} color={PB.red}>
            <Text style={styles.catchDate}>
              {t('result.caughtOn', {
                date: new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(
                  new Date(myCatch.at),
                ),
              })}
            </Text>
            {myCatch.lat !== undefined && myCatch.lng !== undefined && (
              <Pressable
                accessibilityRole="button"
                onPress={() => go('map', { focus: { lat: myCatch.lat!, lng: myCatch.lng! } })}
                style={{ marginTop: 6 }}
              >
                <Text style={styles.linkText}>{t('result.showOnMap')}</Text>
              </Pressable>
            )}
          </Section>
        )}

        <SpeciesSize bug={bug} lang={language} name={localizedName} />
        <SpeciesSeason bug={bug} lang={language} nearby={nearby} />
        <SpeciesLifeCycle bug={bug} />

        <View style={{ marginTop: 14 }}>
          {/* Only a scan (which always has a confidence) can add a species. Opened from a
              sighting, a region sample or the like, an uncaught species is something to hunt. */}
          <Btn
            full
            bg={PB.ink}
            color={PB.yellow}
            size="lg"
            onPress={alreadyCaught ? share : conf !== undefined ? onAdd : () => go('scan', { hint: bug.id })}
          >
            {alreadyCaught ? t('result.share') : conf !== undefined ? t('result.addToDex') : t('home.hunt')}
          </Btn>
          {alreadyCaught && conf === undefined ? (
            <Pressable
              accessibilityRole="button"
              style={styles.removeLink}
              onPress={() =>
                Alert.alert(t('result.removeTitle'), t('result.removeBody', { name: localizedName }), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('result.removeCta'),
                    style: 'destructive',
                    onPress: () => {
                      void removeFromDex(bug.id);
                      go('dex');
                    },
                  },
                ])
              }
            >
              <Text style={styles.removeText}>{t('result.removeFromDex')}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, paddingTop: 50, paddingBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headTitle: { fontSize: 16, fontWeight: '800' },
  scroll: { paddingVertical: 12, paddingHorizontal: 14 },
  heroSticker: { padding: 0, overflow: 'hidden' },
  heroIcon: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: PB.cream2 },
  heroImage: { height: 200, position: 'relative', backgroundColor: '#fff', overflow: 'hidden' },
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
  factValue: { fontSize: 13, fontWeight: '800', color: PB.ink, marginTop: 3, lineHeight: 16 },
  familyNote: { marginTop: 8, fontSize: 11, color: PB.ink, opacity: 0.7, textAlign: 'center' },
  taxon: { fontSize: 12, fontWeight: '800', color: PB.ink, marginTop: 6 },
  catchDate: { fontSize: 15, fontWeight: '800', color: PB.ink },
  linkText: { fontSize: 13, fontWeight: '800', color: PB.ink, textDecorationLine: 'underline' },
  removeLink: { marginTop: 14, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  removeText: { fontSize: 13, fontWeight: '800', color: PB.ink, opacity: 0.7, textDecorationLine: 'underline' },
});
