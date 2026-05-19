import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { PERSONAS, type PersonaId } from '@/personas';
import { useAppStore } from '@/store/useAppStore';

export function PersonaPick({ pid, compact }: { pid: PersonaId; compact?: boolean }) {
  const setPersona = useAppStore((s) => s.setPersona);
  const active = useAppStore((s) => s.persona === pid);
  const p = PERSONAS[pid];

  return (
    <Pressable
      onPress={() => setPersona(pid)}
      style={[
        styles.row,
        {
          paddingVertical: compact ? 8 : 12,
          paddingHorizontal: compact ? 10 : 12,
          backgroundColor: active ? PB.cream : PB.paper,
          shadowOffset: active ? { width: 4, height: 4 } : { width: 2, height: 2 },
          transform: active ? [{ translateX: -1 }, { translateY: -1 }] : [],
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: p.avatarBg }]}>
        <Text style={styles.avatarEmoji}>{p.emoji}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{p.name}</Text>
        <Text style={styles.blurb}>{p.blurb}</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: active ? PB.green : PB.cream }]}>
        {active ? <Text style={styles.dotCheck}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '800', color: PB.ink, lineHeight: 16 },
  blurb: { fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 2 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: { fontSize: 12, fontWeight: '800', color: PB.cream },
});
