import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Btn } from '@/components/Btn';
import { PersonaPick } from '@/components/PersonaPick';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { PERSONA_IDS } from '@/personas';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

export function Onboarding() {
  const { go } = useNav();
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const t = useT();
  return (
    <View style={styles.root}>
      {/* Decorative confetti */}
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 360 720"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Circle cx={60}  cy={100} r={6} fill={PB.ink} />
        <Circle cx={320} cy={160} r={4} fill={PB.red} />
        <Path d="M280 80 q 10 -10 20 0 t 20 0" stroke={PB.ink} strokeWidth={2.5} fill="none" />
        <Circle cx={40} cy={600} r={8} fill={PB.green} />
        <Path d="M30 520 q 20 -10 40 0 t 40 0" stroke={PB.ink} strokeWidth={2.5} fill="none" />
      </Svg>

      <View style={styles.contentWrap}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🪲</Text>
          </View>
          <View>
            <Text style={styles.title}>{t('onboarding.title')}</Text>
            <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>
          </View>
        </View>

        <View style={styles.choices}>
          <Sticker bg={PB.green} rotate={-4} style={styles.choice} onPress={() => go('scan')}>
            <Text style={styles.choiceText}>{t('onboarding.snap')}</Text>
          </Sticker>
          <Sticker bg={PB.blue} rotate={3} style={styles.choice} onPress={() => go('chat')}>
            <Text style={styles.choiceText}>{t('onboarding.sassyId')}</Text>
          </Sticker>
          <Sticker bg={PB.purple} rotate={-2} style={styles.choice} onPress={() => go('dex')}>
            <Text style={styles.choiceText}>{t('onboarding.buildDex')}</Text>
          </Sticker>
        </View>

        <View style={styles.personaBlock}>
          <Text style={styles.section}>{t('onboarding.pickGuide')}</Text>
          <View style={{ gap: 8 }}>
            {PERSONA_IDS.map((pid) => (
              <PersonaPick key={pid} pid={pid} compact />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Btn full bg={PB.ink} color={PB.yellow} size="lg" onPress={() => go('permissions')}>
            {t('onboarding.startHunting')}
          </Btn>
          <Text style={styles.legal}>
            {t(networkOn ? 'onboarding.legalOnline' : 'onboarding.legal')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.yellow, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 28 },
  contentWrap: { flex: 1 },
  brandRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  logoEmoji: { fontSize: 28 },
  title: { fontSize: 36, fontWeight: '800', color: PB.ink, lineHeight: 36 },
  tagline: { fontSize: 12, color: PB.ink, marginTop: 4, fontWeight: '600' },
  choices: { marginTop: 36, gap: 16, alignItems: 'center' },
  choice: { paddingVertical: 14, paddingHorizontal: 18, alignSelf: 'stretch' },
  choiceText: { fontSize: 18, color: PB.cream, fontWeight: '800', textAlign: 'center' },
  personaBlock: { marginTop: 26 },
  section: { fontSize: 11, fontWeight: '800', color: PB.ink, opacity: 0.7, letterSpacing: 0.8, marginBottom: 8 },
  footer: { marginTop: 'auto', gap: 10 },
  legal: { textAlign: 'center', fontSize: 12, color: PB.ink, fontWeight: '600' },
});
