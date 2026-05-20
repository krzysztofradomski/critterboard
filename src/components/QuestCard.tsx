import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import type { Quest } from '@/data/quests';

export function QuestCard({
  quest,
  accent,
  onPress,
}: {
  quest: Quest;
  accent: string;
  onPress?: () => void;
}) {
  const t = useT();
  const pct = (100 * quest.progress) / quest.total;
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{t(`quests.labels.${quest.id}`)}</Text>
        <View style={[styles.pill, { backgroundColor: accent }]}>
          <Text style={styles.pillText}>+{quest.reward} XP</Text>
        </View>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: accent }]} />
      </View>
      <Text style={styles.progress}>
        {quest.progress} / {quest.total}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 5,
    padding: 12,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '800', color: PB.ink, flexShrink: 1, paddingRight: 8 },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
  },
  pillText: { color: PB.cream, fontSize: 11, fontWeight: '800' },
  bar: {
    marginTop: 8,
    height: 10,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  progress: { marginTop: 4, fontSize: 11, color: PB.ink, opacity: 0.6, textAlign: 'right' },
});
