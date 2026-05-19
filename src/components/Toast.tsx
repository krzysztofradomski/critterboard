import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { Sticker } from '@/components/Sticker';

export type ToastSpec = {
  text: string;
  icon?: string;
  bg?: string;
};

export function Toast({ toast }: { toast: ToastSpec | null }) {
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    scale.setValue(0.88);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 110 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [toast, scale, opacity]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ scale }] }]} pointerEvents="none">
      <Sticker bg={toast.bg || PB.yellow} rotate={-1} style={styles.sticker}>
        <View style={styles.row}>
          <Text style={styles.icon}>{toast.icon || '✨'}</Text>
          <Text style={styles.text}>{toast.text}</Text>
        </View>
      </Sticker>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  sticker: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { fontSize: 22 },
  text: {
    fontSize: 14,
    fontWeight: '800',
    color: PB.ink,
    lineHeight: 17,
    flexShrink: 1,
  },
});
