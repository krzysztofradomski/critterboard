import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { PB } from '@/tokens/pb';

/**
 * Shared bottom-sheet shell used by QuestDialog, BadgeDialog,
 * CreditsDialog and PersonModal. Renders a tinted backdrop + an
 * inked cream card that rises into view with a subtle overshoot.
 */
export function ModalShell({
  visible,
  onClose,
  children,
  maxWidth = 360,
  paddingTop = 32,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  paddingTop?: number;
}) {
  const ty = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    ty.setValue(20);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(ty, { toValue: 0, useNativeDriver: true, friction: 8, tension: 90 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, ty, opacity]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[styles.backdrop, { paddingTop }]}>
        <Animated.View
          style={[
            styles.card,
            { maxWidth, opacity, transform: [{ translateY: ty }] },
          ]}
        >
          {/* Pressable child intercepts taps so they don't dismiss. */}
          <Pressable onPress={() => null} style={{ width: '100%' }}>
            <View>{children}</View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,18,8,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    width: '100%',
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 22,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    elevation: 8,
    overflow: 'hidden',
  },
});
