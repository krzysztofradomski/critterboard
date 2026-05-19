import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PB } from '@/tokens/pb';

export type StickerProps = {
  children: React.ReactNode;
  bg?: string;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

/**
 * The signature "sticker" container: cream paper, ink border, hard offset
 * shadow, optional rotation. The whole UI is built out of these.
 */
export function Sticker({ children, bg = PB.paper, rotate = 0, style, onPress }: StickerProps) {
  const [pressed, setPressed] = useState(false);
  const isInteractive = !!onPress;

  const transform = [
    { rotate: `${rotate}deg` },
    ...(isInteractive && pressed
      ? [{ translateX: 3 }, { translateY: 3 }]
      : []),
  ];

  const dynamic: ViewStyle = {
    backgroundColor: bg,
    transform,
    shadowOffset: isInteractive && pressed ? { width: 1, height: 1 } : { width: 4, height: 4 },
  };

  if (!isInteractive) {
    return <View style={[styles.base, dynamic, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.base, dynamic, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 18,
    padding: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
});
