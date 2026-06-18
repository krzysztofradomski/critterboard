import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";

import { USE_NATIVE_DRIVER } from "@/lib/animation";

/**
 * Fade-up wrapper used by every screen, ported from the prototype's
 * `pb-fade` keyframe (220ms, ease-out, 8px translateY).
 */
export function Screen({
  children,
  keyName,
}: {
  children: React.ReactNode;
  keyName: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    ty.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration: 220,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [keyName, opacity, ty]);

  return (
    <Animated.View
      style={[
        styles.fill,
        { opacity, transform: [{ translateY: ty }], pointerEvents: "box-none" },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
