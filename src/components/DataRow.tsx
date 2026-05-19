import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';

export type DataRowProps = {
  icon: string;
  color: string;
  title: string;
  desc: string;
  cta: string;
  dark?: boolean;
  onPress?: () => void;
};

export function DataRow({ icon, color, title, desc, cta, dark, onPress }: DataRowProps) {
  const fg = dark ? PB.cream : PB.ink;
  return (
    <View style={[styles.row, { backgroundColor: dark ? PB.ink : PB.cream }]}>
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: fg }]}>{title}</Text>
        <Text style={[styles.desc, { color: fg, opacity: dark ? 0.85 : 0.6 }]}>{desc}</Text>
      </View>
      <Pressable onPress={onPress} style={[styles.cta, { backgroundColor: dark ? PB.red : PB.yellow }]}>
        <Text style={[styles.ctaText, { color: dark ? PB.cream : PB.ink }]}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '800', lineHeight: 14 },
  desc: { fontSize: 10, marginTop: 2 },
  cta: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  ctaText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});
