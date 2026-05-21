import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { usePersona } from '@/personas/hooks';
import type { PersonaId } from '@/personas';
import { useAppStore } from '@/store/useAppStore';

export function PersonaPick({ pid, compact }: { pid: PersonaId; compact?: boolean }) {
  const setPersona = useAppStore((s) => s.setPersona);
  const active = useAppStore((s) => s.persona === pid);
  const p = usePersona(pid);

  /**
   * Avatar pulse on activation. We watch the `active` flag and replay a
   * 1 → 1.18 → 1 spring/timing sequence whenever it flips on (deactivation
   * is silent — only the new pick "lights up"). The animation drives a
   * scale transform on the avatar circle; everything else stays still.
   */
  const pulse = useRef(new Animated.Value(1)).current;
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      pulse.setValue(1);
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 140, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      ]).start();
    }
    wasActive.current = active;
  }, [active, pulse]);

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
      <Animated.View
        style={[styles.avatar, { backgroundColor: p.avatarBg, transform: [{ scale: pulse }] }]}
      >
        <Text style={styles.avatarEmoji}>{p.emoji}</Text>
      </Animated.View>
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
