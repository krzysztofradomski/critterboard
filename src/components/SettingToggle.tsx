import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';

export type SettingToggleProps = {
  icon: string;
  color: string;
  label: string;
  desc: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function SettingToggle({
  icon,
  color,
  label,
  desc,
  value,
  onChange,
  disabled,
}: SettingToggleProps) {
  return (
    <View style={[styles.row, { opacity: disabled ? 0.55 : 1 }]}>
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.desc}>{desc}</Text>
      </View>
      <Pressable
        disabled={disabled}
        onPress={() => onChange(!value)}
        style={[
          styles.track,
          { backgroundColor: value ? PB.green : PB.cream2 },
        ]}
      >
        <View style={[styles.thumb, { left: value ? 20 : 2 }]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 16 },
  body: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 14 },
  desc: { fontSize: 11, color: PB.ink, opacity: 0.65, fontWeight: '600', marginTop: 2 },
  track: {
    width: 44,
    height: 26,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: PB.ink,
  },
});
