import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sticker } from '@/components/Sticker';
import type { Bug } from '@/data/bugs';
import {
  aboutText,
  badges,
  formatSize,
  gardenRole,
  lifeCycle,
  peakMonths,
  safety,
  seasonLevels,
  sizeComparison,
  wikipediaUrl,
  type Safety,
} from '@/data/speciesFacts';
import type { LangId } from '@/i18n';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';

type Props = { bug: Bug; lang: LangId };

const SAFETY_BG: Record<Safety, string> = {
  harmless: PB.green,
  bite: PB.yellow,
  sting: PB.red,
  tick: PB.red,
  irritant: PB.red,
};
const SAFETY_ICON: Record<Safety, string> = { harmless: '🙂', bite: '🦷', sting: '⚠️', tick: '⚠️', irritant: '🖐️' };

/** Garden role, what it does, and whether it is safe to handle: right under the hero. */
export function SpeciesBadges({ bug }: { bug: Bug }) {
  const t = useT();
  const role = gardenRole(bug);
  const list = badges(bug);
  const safe = safety(bug);
  if (!role && list.length === 0 && !safe) return null;
  return (
    <View style={{ marginTop: 12 }}>
      {(role || list.length > 0) && (
        <View style={styles.pills}>
          {role && (
            <View style={[styles.pill, { backgroundColor: role === 'friend' ? PB.green : PB.yellow }]}>
              <Text style={[styles.pillText, role === 'friend' && { color: PB.cream }]}>{t(`facts.role.${role}`)}</Text>
            </View>
          )}
          {list.map((b) => (
            <View key={b} style={styles.pill}>
              <Text style={styles.pillText}>{t(`facts.badge.${b}`)}</Text>
            </View>
          ))}
        </View>
      )}
      {safe && (
        <View
          style={[styles.safety, { backgroundColor: SAFETY_BG[safe] }]}
          accessible
          accessibilityLabel={`${t('result.safetyTitle')}: ${t(`facts.safety.${safe}`)}`}
        >
          <Text style={{ fontSize: 16 }}>{SAFETY_ICON[safe]}</Text>
          <Text style={[styles.safetyText, safe !== 'bite' && { color: PB.cream }]}>{t(`facts.safety.${safe}`)}</Text>
        </View>
      )}
    </View>
  );
}

/** Description with its Wikipedia credit; the bare "read more" link when there is no text. */
export function SpeciesAbout({ bug, lang }: Props) {
  const t = useT();
  const text = aboutText(bug, lang);
  const open = () => void Linking.openURL(wikipediaUrl(bug, lang));
  if (!text) {
    return (
      <Pressable onPress={open} accessibilityRole="link" style={styles.readMore}>
        <Text style={styles.readMoreText}>{t('result.readMore')}</Text>
      </Pressable>
    );
  }
  return (
    <Section title={t('result.about')} color={PB.blue}>
      <Text style={styles.body}>{text}</Text>
      <Pressable onPress={open} accessibilityRole="link" style={{ marginTop: 4 }}>
        <Text style={styles.note}>
          {t('result.wikiCredit')} · <Text style={styles.link}>{t('result.readMore')}</Text>
        </Text>
      </Pressable>
    </Section>
  );
}

/** Size next to an everyday object, two bars drawn to the same scale. */
export function SpeciesSize({ bug, lang, name }: Props & { name: string }) {
  const t = useT();
  const cmp = sizeComparison(bug);
  if (!cmp || !bug.facts?.sz) return null;
  const max = Math.max(cmp.mm, cmp.refMm);
  const refName = t(`facts.ref.${cmp.ref}`);
  return (
    <Section title={t('result.sizeTitle')} color={PB.blue}>
      <Text style={styles.body}>{t('result.sizeAbout', { ref: refName })}</Text>
      <Bar label={`${name} · ${formatSize(bug.facts.sz, lang)}`} pct={cmp.mm / max} color={bug.color} />
      <Bar label={`${refName} · ${formatSize([cmp.refMm, cmp.refMm], lang)}`} pct={cmp.refMm / max} color={PB.cream2} />
    </Section>
  );
}

/** Records per month as 12 bars, the busiest stretch in words, and nearby sightings (when shared). */
export function SpeciesSeason({ bug, lang, nearby }: Props & { nearby: number }) {
  const t = useT();
  const levels = seasonLevels(bug);
  if (!levels && nearby === 0) return null;
  const month = (i: number, style: 'narrow' | 'short') =>
    new Intl.DateTimeFormat(lang, { month: style }).format(new Date(2026, i, 15));
  const peak = levels ? peakMonths(levels) : null;
  return (
    <Section title={t('result.seasonTitle')} color={PB.green}>
      {peak && (
        <Text style={styles.body}>
          {peak[0] === peak[1]
            ? t('result.seasonPeakOne', { month: month(peak[0], 'short') })
            : t('result.seasonPeak', { from: month(peak[0], 'short'), to: month(peak[1], 'short') })}
        </Text>
      )}
      {levels && (
        <>
          <View style={styles.months} accessible accessibilityLabel={t('result.seasonNote')}>
            {levels.map((v, i) => (
              <View key={i} style={styles.monthCol}>
                <View style={styles.monthTrack}>
                  <View style={[styles.monthFill, { height: `${Math.max(v, 0.4) * 10}%`, opacity: v >= 5 ? 1 : 0.55 }]} />
                </View>
                <Text style={styles.monthLabel}>{month(i, 'narrow')}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>{t('result.seasonNote')}</Text>
        </>
      )}
      {nearby > 0 && <Text style={[styles.body, { marginTop: 8 }]}>{t('result.nearby', { n: nearby })}</Text>}
    </Section>
  );
}

/** Life stages as a strip of chips, with one line on the kind of metamorphosis. */
export function SpeciesLifeCycle({ bug }: { bug: Bug }) {
  const t = useT();
  const cycle = lifeCycle(bug);
  if (!cycle) return null;
  return (
    <Section title={t('result.lifeTitle')} color={PB.purple}>
      <View style={styles.stages}>
        {cycle.stages.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <Text style={styles.arrow}>→</Text>}
            <View style={styles.stage}>
              <Text style={styles.stageText}>{s === 'adult' ? `${bug.emoji} ` : ''}{t(`facts.stage.${s}`)}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <Text style={[styles.note, { marginTop: 8 }]}>{t(`facts.cycle.${cycle.kind}`)}</Text>
    </Section>
  );
}

export function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <Sticker bg={PB.cream} style={styles.section}>
      <Text style={[styles.label, { color }]}>{title}</Text>
      {children}
    </Sticker>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={[styles.bar, { width: `${Math.max(pct * 100, 4)}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  pillText: { fontSize: 12, fontWeight: '800', color: PB.ink },
  safety: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  safetyText: { flex: 1, fontSize: 13, fontWeight: '800', color: PB.ink },
  section: { marginTop: 14, padding: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  body: { fontSize: 14, fontWeight: '600', color: PB.ink, lineHeight: 19 },
  note: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 4 },
  link: { fontWeight: '800', textDecorationLine: 'underline' },
  readMore: { marginTop: 12, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  readMoreText: { fontSize: 12, fontWeight: '800', color: PB.ink, textDecorationLine: 'underline' },
  barLabel: { fontSize: 12, fontWeight: '700', color: PB.ink, marginBottom: 3 },
  bar: { height: 12, borderColor: PB.ink, borderWidth: 2, borderRadius: 99 },
  months: { flexDirection: 'row', gap: 3, marginTop: 10 },
  monthCol: { flex: 1, alignItems: 'center' },
  monthTrack: { width: '100%', height: 44, justifyContent: 'flex-end' },
  monthFill: { width: '100%', backgroundColor: PB.green, borderColor: PB.ink, borderWidth: 1.5, borderRadius: 3 },
  monthLabel: { fontSize: 10, fontWeight: '800', color: PB.ink, marginTop: 3 },
  stages: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  stage: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: PB.cream2, borderColor: PB.ink, borderWidth: 2, borderRadius: 8 },
  stageText: { fontSize: 12, fontWeight: '800', color: PB.ink },
  arrow: { fontSize: 14, fontWeight: '800', color: PB.ink },
});
