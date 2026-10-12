import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useT } from '@/i18n/helpers';
import { photoFileUri } from '@/lib/photos';
import { clampScale, clampTranslate, doubleTapScale, fitContain, zoomAround, type Size } from '@/lib/zoom';

/** Swipe down at 1x farther than this, or faster than DISMISS_VELOCITY, to close. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * Full-screen photo: pinch to zoom (1x–5x) around the fingers, pan while zoomed (stopping at
 * the edges), double tap to toggle 2.5x, swipe down at 1x or tap ✕ to close.
 */
export function PhotoLightbox({ uri, visible, onClose }: { uri: string | null; visible: boolean; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const view: Size = { w: width, h: height };
  const src = uri ? photoFileUri(uri) : null;
  const [image, setImage] = useState<Size>({ w: 0, h: 0 });
  const content = fitContain(view, image);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const dismissY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scale.value = savedScale.value = 1;
    tx.value = ty.value = savedTx.value = savedTy.value = 0;
    dismissY.value = 0;
    if (src) Image.getSize(src, (w, h) => setImage({ w, h }), () => setImage({ w: 0, h: 0 }));
  }, [visible, src]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    'worklet';
    savedScale.value = scale.value;
    savedTx.value = tx.value;
    savedTy.value = ty.value;
  };

  const pinch = Gesture.Pinch()
    .onStart(save)
    .onUpdate((e) => {
      const to = clampScale(savedScale.value * e.scale);
      const focal = { x: e.focalX - view.w / 2, y: e.focalY - view.h / 2 };
      const next = zoomAround({ x: savedTx.value, y: savedTy.value }, focal, savedScale.value, to);
      const c = clampTranslate(to, view, content, next);
      scale.value = to;
      tx.value = c.x;
      ty.value = c.y;
    })
    .onEnd(save);

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(save)
    .onUpdate((e) => {
      if (scale.value > 1.01) {
        const c = clampTranslate(scale.value, view, content, {
          x: savedTx.value + e.translationX,
          y: savedTy.value + e.translationY,
        });
        tx.value = c.x;
        ty.value = c.y;
      } else {
        dismissY.value = Math.max(0, e.translationY);
      }
    })
    .onEnd((e) => {
      if (scale.value <= 1.01 && (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY)) {
        scheduleOnRN(onClose);
        return;
      }
      dismissY.value = withSpring(0);
      save();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const to = doubleTapScale(scale.value);
      const focal = { x: e.x - view.w / 2, y: e.y - view.h / 2 };
      const c = to === 1 ? { x: 0, y: 0 } : clampTranslate(to, view, content, zoomAround({ x: tx.value, y: ty.value }, focal, scale.value, to));
      scale.value = withTiming(to);
      tx.value = withTiming(c.x);
      ty.value = withTiming(c.y);
      savedScale.value = to;
      savedTx.value = c.x;
      savedTy.value = c.y;
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value + dismissY.value }, { scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(0.6, dismissY.value / 400) }));

  return (
    <Modal visible={visible && !!src} animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.stage}>
            {src && (
              <Animated.Image
                source={{ uri: src }}
                style={[{ width: content.w, height: content.h }, imageStyle]}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            )}
          </Animated.View>
        </GestureDetector>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('result.closePhoto')}
          style={[styles.close, { top: insets.top + 10, right: insets.right + 14 }]}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
