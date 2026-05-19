import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { PERSONAS } from '@/personas';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Phase = 'aim' | 'flash' | 'analyzing';

export function Scan() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const P = PERSONAS[persona];
  const route = useCurrentRoute();
  const hint = (route.params as { hint?: string } | undefined)?.hint ?? 'mona';

  const [phase, setPhase] = useState<Phase>('aim');
  const [flash, setFlash] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const reticleRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (phase === 'analyzing') {
      Animated.loop(
        Animated.timing(reticleRotate, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ).start();
    }
  }, [phase, reticleRotate]);

  const shutter = () => {
    if (phase !== 'aim') return;
    setFlash(true);
    setPhase('flash');
    setTimeout(() => setFlash(false), 180);
    setTimeout(() => setPhase('analyzing'), 220);
    setTimeout(() => go('result', { id: hint }), 2200);
  };

  return (
    <View style={styles.root}>
      <CameraScene />

      {phase === 'analyzing' && <View style={styles.tint} />}
      {flash && <View style={styles.flash} />}

      <View style={styles.topbar}>
        <IconBtn onPress={back} size={42} fs={18}>✕</IconBtn>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: phase === 'analyzing' ? PB.yellow : PB.green },
          ]}
        >
          <Animated.View style={[styles.dot, { opacity: pulse }]} />
          <Text style={[styles.statusText, { color: phase === 'analyzing' ? PB.ink : PB.cream }]}>
            {phase === 'analyzing' ? 'ANALYZING...' : 'OFFLINE · SCANNING'}
          </Text>
        </View>
        <IconBtn size={42} fs={18} onPress={() => go('soundid')}>🔊</IconBtn>
      </View>

      <Animated.View
        style={[
          styles.reticle,
          {
            borderColor: phase === 'analyzing' ? PB.pink : PB.yellow,
            transform: [
              { translateX: -110 },
              { translateY: -110 },
              {
                rotate: reticleRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
              },
            ],
          },
        ]}
      >
        <View style={styles.focusTag}>
          <Text style={styles.focusTagText}>
            {phase === 'analyzing' ? 'matching...' : 'focus'}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.tipWrap}>
        <Sticker bg={PB.cream} rotate={-1.5} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={styles.tipRow}>
            <View style={[styles.tipAvatar, { backgroundColor: P.avatarBg }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <Text style={styles.tipText}>
              {phase === 'analyzing' ? P.lines.analyzing : P.lines.scanTip}
            </Text>
          </View>
        </Sticker>
      </View>

      <View style={styles.bottomRow}>
        <IconBtn size={48} fs={22} onPress={() => phase === 'aim' && go('disambiguate')}>🖼️</IconBtn>
        <Pressable onPress={shutter} style={[styles.shutter, phase !== 'aim' && styles.shutterPressed]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <IconBtn size={48} fs={22} onPress={() => phase === 'aim' && go('nomatch')}>🤷</IconBtn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.ink, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,8,0.5)' },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 60 },
  topbar: { position: 'absolute', top: 50, left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 10 },
  statusPill: {
    flex: 1,
    height: 42,
    paddingHorizontal: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: PB.cream,
    shadowColor: PB.cream,
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  statusText: { fontSize: 13, fontWeight: '800' },
  reticle: {
    position: 'absolute',
    left: '50%',
    top: '46%',
    width: 220,
    height: 220,
    borderWidth: 4,
    borderRadius: 32,
    borderStyle: 'dashed',
  },
  focusTag: {
    position: 'absolute',
    top: -28,
    left: -4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 8,
  },
  focusTagText: { fontSize: 11, fontWeight: '800', color: PB.ink },
  tipWrap: { position: 'absolute', bottom: 200, left: 12, right: 12, zIndex: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 17 },
  bottomRow: {
    position: 'absolute',
    bottom: 60,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 4,
    backgroundColor: PB.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 },
  },
  shutterPressed: {
    shadowOffset: { width: 2, height: 2 },
    transform: [{ translateX: 3 }, { translateY: 3 }],
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 99,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 3,
  },
});
