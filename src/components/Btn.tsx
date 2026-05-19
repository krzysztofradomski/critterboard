import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { PB } from '@/tokens/pb';

export type BtnProps = {
  children: React.ReactNode;
  onPress?: () => void;
  color?: string;
  bg?: string;
  full?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function Btn({
  children,
  onPress,
  color = PB.ink,
  bg = PB.yellow,
  full,
  size = 'md',
  style,
  disabled,
}: BtnProps) {
  const [pressed, setPressed] = useState(false);
  const pad = size === 'sm' ? { paddingVertical: 8, paddingHorizontal: 14 }
            : size === 'lg' ? { paddingVertical: 16, paddingHorizontal: 22 }
            : { paddingVertical: 12, paddingHorizontal: 18 };
  const fs = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <Pressable
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        pad,
        {
          backgroundColor: bg,
          width: full ? '100%' : undefined,
          opacity: disabled ? 0.5 : 1,
          shadowOffset: pressed ? { width: 1, height: 1 } : { width: 4, height: 4 },
          transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.label, { color, fontSize: fs }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 16,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
