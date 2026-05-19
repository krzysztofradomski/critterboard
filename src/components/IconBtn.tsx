import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PB } from '@/tokens/pb';

export type IconBtnProps = {
  children: React.ReactNode;
  onPress?: () => void;
  bg?: string;
  color?: string;
  size?: number;
  fs?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconBtn({
  children,
  onPress,
  bg = PB.cream,
  color = PB.ink,
  size = 38,
  fs = 16,
  style,
}: IconBtnProps) {
  const [pressed, setPressed] = useState(false);
  const dynamic: ViewStyle = {
    width: size,
    height: size,
    backgroundColor: bg,
    shadowOffset: pressed ? { width: 0, height: 0 } : { width: 2, height: 2 },
    transform: pressed ? [{ translateX: 2 }, { translateY: 2 }] : [],
  };

  const content = typeof children === 'string' ? (
    <Text style={{
      fontSize: fs,
      fontWeight: '800',
      color,
      textAlign: 'center',
    }}>{children}</Text>
  ) : (
    children
  );

  if (!onPress) {
    return <View style={[styles.base, dynamic, style]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.base, dynamic, style]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
