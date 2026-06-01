import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { vision, USE_NATIVE_VISION, useExecutorchClassifier, type Candidate } from '@/ai';
import { Btn } from '@/components/Btn';
import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Phase = 'aim' | 'flash' | 'analyzing';

export function Scan() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const setLastPhotoUri = useAppStore((s) => s.setLastPhotoUri);
  const P = usePersona(persona);
  const t = useT();
  const route = useCurrentRoute();
  const hint = (route.params as { hint?: string } | undefined)?.hint ?? 'lady';

  // ExecuTorch on-device classifier. preventLoad=true keeps it dormant until
  // USE_NATIVE_VISION is flipped to true in src/ai/index.ts.
  const executorch = useExecutorchClassifier(!USE_NATIVE_VISION);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

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

  /**
   * Run the (mock or native) classifier on a captured/picked photo and
   * route to Result / Disambiguate / NoMatch based on the confidence
   * spread. Holds the analysing animation for ~2 s so the UX feels
   * deliberate even when inference is sub-100 ms.
   */
  const classifyAndRoute = (photoUri: string | null) => {
    if (photoUri) setLastPhotoUri(photoUri);
    const startedAt = Date.now();
    void (async () => {
      let candidates: Candidate[] = [];
      try {
        // Use ExecuTorch when native is enabled and the .pte is loaded;
        // otherwise fall through to gemini/mock.
        const classifyFn = USE_NATIVE_VISION && executorch.isReady
          ? executorch.classify
          : vision.classify.bind(vision);
        candidates = await classifyFn(photoUri, { hint, topK: 3 });
      } catch {
        candidates = [];
      }
      const minHold = 2200 - (Date.now() - startedAt);
      setTimeout(() => {
        const top = candidates[0];
        const second = candidates[1];
        const confident =
          top &&
          top.confidence >= 0.7 &&
          (!second || top.confidence - second.confidence >= 0.15);

        if (confident && top) {
          haptics.success();
          go('result', { id: top.bugId, ...(photoUri ? { photoUri } : {}) });
        } else if (candidates.length >= 2) {
          haptics.select();
          go('disambiguate', {
            candidates: candidates.map((c) => c.bugId),
            confs: candidates.map((c) => Math.round(c.confidence * 100)),
          });
        } else {
          haptics.warning();
          go('nomatch');
        }
      }, Math.max(0, minHold));
    })();
  };

  const shutter = async () => {
    if (phase !== 'aim') return;
    haptics.tap();
    setFlash(true);
    setPhase('flash');
    setTimeout(() => setFlash(false), 180);
    setTimeout(() => setPhase('analyzing'), 220);

    // Snap a real photo if the camera is mounted; fall back to a null URI
    // (the mock classifier doesn't care) when running on simulator/web.
    let photoUri: string | null = null;
    try {
      const result = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      photoUri = result?.uri ?? null;
    } catch {
      photoUri = null;
    }
    classifyAndRoute(photoUri);
  };

  const pickFromGallery = async () => {
    if (phase !== 'aim') return;
    const status = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!status.granted) {
      haptics.warning();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const photoUri = result.assets[0]?.uri ?? null;
    haptics.tap();
    setPhase('analyzing');
    classifyAndRoute(photoUri);
  };

  /**
   * Permission states:
   *   - permission is null on first render (hook still bootstrapping)
   *   - granted: show real camera
   *   - denied + canAskAgain: show prompt CTA
   *   - denied + !canAskAgain: explain how to enable in Settings
   */
  const cameraReady = permission?.granted;

  return (
    <View style={styles.root}>
      {cameraReady ? (
        <CameraView
          ref={(ref) => {
            cameraRef.current = ref;
          }}
          style={StyleSheet.absoluteFill}
          facing="back"
          mute
        />
      ) : (
        <CameraScene />
      )}

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
            {phase === 'analyzing' ? t('scan.analyzing') : t('scan.scanning')}
          </Text>
        </View>
        <IconBtn size={42} fs={18} onPress={() => go('soundid')}>🔊</IconBtn>
      </View>

      {!cameraReady && permission && (
        <View style={styles.permissionCard}>
          <Sticker bg={PB.cream} rotate={-1} style={{ padding: 16 }}>
            <Text style={styles.permissionTitle}>{t('scan.permissionTitle')}</Text>
            <Text style={styles.permissionDesc}>
              {permission.canAskAgain ? t('scan.permissionAsk') : t('scan.permissionDenied')}
            </Text>
            {permission.canAskAgain && (
              <Btn full bg={PB.ink} color={PB.yellow} onPress={requestPermission} style={{ marginTop: 12 }}>
                {t('scan.allowCamera')}
              </Btn>
            )}
          </Sticker>
        </View>
      )}

      {USE_NATIVE_VISION && !executorch.isReady && !executorch.error && (
        <View style={styles.modelBanner}>
          <Text style={styles.modelBannerText}>
            {executorch.downloadProgress > 0
              ? `Fetching model… ${Math.round(executorch.downloadProgress * 100)}%`
              : 'Loading model…'}
          </Text>
        </View>
      )}

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
            {phase === 'analyzing' ? t('scan.matching') : t('scan.focus')}
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
        <IconBtn size={48} fs={22} onPress={pickFromGallery}>🖼️</IconBtn>
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
  permissionCard: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  permissionTitle: { fontFamily: undefined, fontSize: 18, fontWeight: '800', color: PB.ink },
  permissionDesc: { marginTop: 6, fontSize: 13, color: PB.ink, opacity: 0.75, lineHeight: 18 },
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
  modelBanner: {
    position: 'absolute',
    bottom: 160,
    left: 12,
    right: 12,
    backgroundColor: PB.ink,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    zIndex: 10,
  },
  modelBannerText: {
    color: PB.yellow,
    fontSize: 12,
    fontWeight: '700',
  },
});
