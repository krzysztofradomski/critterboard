import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { findBug } from '@/data/bugs';
import { useT, bugName } from '@/i18n/helpers';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

export function Disambiguate() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const language = useAppStore((s) => s.language);
  const P = usePersona(persona);
  const t = useT();
  const route = useCurrentRoute();
  const params = (route.params as { candidates?: string[]; confs?: number[]; photoUri?: string } | undefined) ?? {};
  const candIds = params.candidates ?? ['mona', 'atla', 'drag'];
  const confs = params.confs ?? [62, 41, 23];
  const photoUri = params.photoUri;

  const candidates = candIds
    .map((id, i) => {
      const b = findBug(id);
      if (!b) return null;
      return { ...b, name: bugName(language, b.id), conf: confs[i] ?? 30 };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const uncertainLine = P.uncertain;
  const personaShort = P.name.split(' ').pop() ?? P.name;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <Text style={styles.title}>{t('disambiguate.headTitle')}</Text>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <Sticker bg={PB.cream} rotate={-1} style={{ padding: 0, overflow: 'hidden' }}>
          <View style={styles.photo}>
            <CameraScene dark={false} />
            <View style={styles.fuzz} pointerEvents="none" />
            <View style={styles.lowBadge}>
              <Text style={styles.lowText}>{t('disambiguate.lowConfidence')}</Text>
            </View>
            <View style={styles.shotBadge}>
              <Text style={styles.shotText}>{t('disambiguate.shotMeta')}</Text>
            </View>
          </View>
        </Sticker>

        <Sticker bg={P.cardBg} rotate={1.5} style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={styles.snarkRow}>
            <View style={[styles.snarkAvatar, { backgroundColor: PB.cream }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <Text style={styles.snark}>{uncertainLine}</Text>
          </View>
        </Sticker>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>{t('disambiguate.topCandidates')}</Text>
          <Text style={styles.sectionHint}>{t('disambiguate.tapToConfirm')}</Text>
        </View>

        <View style={{ gap: 10 }}>
          {candidates.map((c, i) => {
            const ring = i === 0 ? PB.green : i === 1 ? PB.orange : PB.cream2;
            return (
              <Pressable
                key={c.id}
                onPress={() => go('result', { id: c.id, conf: c.conf, ...(photoUri ? { photoUri } : {}) })}
                style={styles.candidate}
              >
                <View style={[styles.candidateArt, { backgroundColor: c.color || PB.cream2 }]}>
                  <Text style={{ fontSize: 28 }}>{c.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text numberOfLines={1} style={styles.candidateName}>{c.name}</Text>
                    <Text style={[styles.candidateConf, { color: ring === PB.cream2 ? PB.ink : ring }]}>
                      {c.conf}%
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={styles.candidateLatin}>{c.latin}</Text>
                  <View style={styles.candidateBar}>
                    <View style={[styles.candidateFill, { width: `${c.conf}%`, backgroundColor: ring }]} />
                  </View>
                </View>
                <Text style={styles.arrow}>→</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 16, gap: 8 }}>
          <Btn full bg={PB.cream} color={PB.ink} onPress={() => go('chat', { topic: t('disambiguate.thisMystery') })}>
            {t('disambiguate.askForHelp', { name: personaShort })}
          </Btn>
          <Btn full bg={PB.red} color={PB.cream} onPress={() => go('nomatch')}>
            {t('disambiguate.noneOfThese')}
          </Btn>
        </View>

        <Text style={styles.foot}>{t('disambiguate.foot')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.yellow, paddingTop: 50, paddingBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontSize: 16, fontWeight: '800', color: PB.ink },
  photo: { height: 160, backgroundColor: '#fff', position: 'relative', overflow: 'hidden' },
  fuzz: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,244,220,0.55)' },
  lowBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.orange,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  lowText: { fontSize: 11, fontWeight: '800', color: PB.ink },
  shotBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  shotText: { fontSize: 10, fontWeight: '700', color: PB.ink },
  snarkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  snarkAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snark: { flex: 1, fontSize: 14, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  sectionRow: {
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  section: { fontSize: 11, fontWeight: '800', color: PB.ink, letterSpacing: 0.6 },
  sectionHint: { fontSize: 10, color: PB.ink, opacity: 0.6 },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 16,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  candidateArt: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateName: { fontSize: 16, fontWeight: '800', color: PB.ink, lineHeight: 16, flexShrink: 1 },
  candidateConf: { fontSize: 14, fontWeight: '800', marginLeft: 6 },
  candidateLatin: { fontSize: 11, color: PB.ink, opacity: 0.6, marginTop: 2, fontStyle: 'italic' },
  candidateBar: {
    marginTop: 8,
    height: 8,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 1.5,
    borderRadius: 99,
    overflow: 'hidden',
  },
  candidateFill: { height: '100%' },
  arrow: { fontSize: 18, fontWeight: '800', color: PB.ink },
  foot: { marginTop: 12, fontSize: 10, color: PB.ink, opacity: 0.55, textAlign: 'center' },
});
