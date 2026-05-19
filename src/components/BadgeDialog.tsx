import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { ModalShell } from '@/components/ModalShell';
import type { Badge } from '@/data/badges';
import type { Persona } from '@/personas';

export function BadgeDialog({
  badge,
  persona,
  visible,
  onClose,
}: {
  badge: Badge | null;
  persona: Persona;
  visible: boolean;
  onClose: () => void;
}) {
  if (!badge) return null;
  const locked = !badge.unlocked;

  const personaLine = locked
    ? persona.id === 'larva'
      ? "Don't get excited. You haven't earned it yet."
      : persona.id === 'snail'
      ? 'Patience. It will come when it comes.'
      : "Ooh, this one's GREAT — you're gonna love unlocking it!"
    : persona.id === 'larva'
    ? "Fine. I'm a little impressed. Don't make it weird."
    : persona.id === 'snail'
    ? 'Well-earned. A quiet moment to be proud.'
    : "YES! Look at you! I'm putting this in the notebook!";

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View style={{ padding: 18 }}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.bigIcon,
              {
                backgroundColor: badge.color,
                opacity: locked ? 0.65 : 1,
              },
            ]}
          >
            <Text style={styles.bigIconText}>{locked ? '?' : badge.icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.pillRow}>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: locked ? PB.cream2 : PB.green },
                ]}
              >
                <Text style={[styles.pillText, { color: locked ? PB.ink : PB.cream }]}>
                  {locked ? '🔒 LOCKED' : '✓ EARNED'}
                </Text>
              </View>
              {!locked && badge.earned ? (
                <Text style={styles.earned}>{badge.earned}</Text>
              ) : null}
            </View>
            <Text style={styles.title}>
              {locked && badge.name === '???' ? 'Hidden badge' : badge.name}
            </Text>
          </View>
          <IconBtn onPress={onClose} size={32} fs={14}>✕</IconBtn>
        </View>

        <View style={styles.descBox}>
          <Text style={styles.descText}>{badge.desc}</Text>
        </View>

        <View style={styles.howBox}>
          <Text style={styles.howLabel}>HOW</Text>
          <Text style={styles.howText}>{badge.crit}</Text>
        </View>

        <View style={[styles.personaBox, { backgroundColor: persona.cardBg }]}>
          <View style={styles.personaAvatar}>
            <Text style={{ fontSize: 14 }}>{persona.emoji}</Text>
          </View>
          <Text style={styles.personaText}>{personaLine}</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <Btn full bg={PB.ink} color={PB.yellow} onPress={onClose}>Got it</Btn>
        </View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  bigIconText: { fontSize: 38 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderColor: PB.ink, borderWidth: 2, borderRadius: 99 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  earned: { fontSize: 11, color: PB.ink, opacity: 0.65, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', color: PB.ink, lineHeight: 24, marginTop: 6 },
  descBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
  },
  descText: { fontSize: 14, color: PB.ink, fontWeight: '500', lineHeight: 20 },
  howBox: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  howLabel: { fontSize: 10, fontWeight: '800', color: PB.ink, opacity: 0.7, letterSpacing: 0.6 },
  howText: { flex: 1, fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 17 },
  personaBox: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  personaAvatar: {
    width: 28,
    height: 28,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    backgroundColor: PB.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaText: { flex: 1, fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 18 },
});
