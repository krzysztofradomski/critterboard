import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PB } from '@/tokens/pb';

export type ProgressBarProps = {
  value: number;
  max: number;
  color?: string;
  bg?: string;
  height?: number;
  radius?: number;
  borderColor?: string;
  borderWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  value,
  max,
  color = PB.green,
  bg = PB.cream2,
  height = 10,
  radius = 99,
  borderColor,
  borderWidth,
  style,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <View
      style={[
        styles.outer,
        {
          height,
          backgroundColor: bg,
          borderRadius: radius,
          borderColor: borderColor ?? 'transparent',
          borderWidth: borderWidth ?? 0,
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: radius,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    overflow: 'hidden',
  },
});
