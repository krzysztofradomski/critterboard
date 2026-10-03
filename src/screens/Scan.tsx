import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import * as FileSystem from 'expo-file-system/legacy';
import { vision, USE_NATIVE_VISION, useExecutorchClassifier, type Candidate } from '@/ai';
import { getModelPath } from '@/data/regionPacks';
import { selectScanClassifier } from '@/ai/scanClassifier';
import { Btn } from '@/components/Btn';
import { CameraScene } from '@/components/CameraScene';
import { IconBtn } from '@/components/IconBtn';
import { PhotoTipsDialog } from '@/components/PhotoTipsDialog';
import { Sticker } from '@/components/Sticker';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Phase = 'aim' | 'flash' | 'analyzing';

const ZOOM_PER_LN = 0.36;

function touchDistance(e: GestureResponderEvent): number {
  const [a, b] = e.nativeEvent.touches;
  return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
}

export function Scan() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const setLastPhotoUri = useAppStore((s) => s.setLastPhotoUri);
  const minConfidence = useAppStore((s) => s.profile.minConfidence);
  const P = usePersona(persona);
  const t = useT();
  const route = useCurrentRoute();
  const hint = (route.params as { hint?: string } | undefined)?.hint ?? 'lady';

  const activeRegionId = useAppStore((s) => s.activeRegion);
  const activeLabelMap = useAppStore((s) => s.activeLabelMap);
  const modelSource = activeRegionId && FileSystem.documentDirectory
    ? getModelPath(FileSystem.documentDirectory, activeRegionId)
    : null;

  // ExecuTorch on-device classifier. Driven by the active region
  // pack — modelSource is its .pte path on disk, labelMap maps scientific
  // names to class indices. preventLoad keeps it dormant until both
  // USE_NATIVE_VISION is on and a pack has been installed.
  const executorch = useExecutorchClassifier({
    modelSource,
    labelMap: activeLabelMap,
    preventLoad: !USE_NATIVE_VISION || !activeRegionId,
  });

  // Phones identify only with the on-device model. No pack installed → ask
  // the user to install one; the web preview (no ExecuTorch) uses the mock.
  const isWeb = Platform.OS === 'web';
  const needsPack = USE_NATIVE_VISION && !isWeb && !activeRegionId;
  const modelLoading =
    USE_NATIVE_VISION && !isWeb && !!activeRegionId && !executorch.isReady && !executorch.error;
  const showToast = useAppStore((s) => s.showToast);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

  const [phase, setPhase] = useState<Phase>('aim');
  const [tipsOpen, setTipsOpen] = useState(false);
  // The guide's hint is a greeting, not a status: show it on arrival, then get out of the way.
  const [tipVisible, setTipVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTipVisible(false), 6000);
    return () => clearTimeout(id);
  }, []);
  const [flash, setFlash] = useState(false);

  // Pinch to zoom. expo-camera's zoom is 0..1 of the lens range; on iOS it is exponential
  // (min × (max/min)^zoom), so adding ln(scale) × ZOOM_PER_LN keeps a pinch feeling the same at
  // every zoom level. ZOOM_PER_LN ≈ 1 / ln(max/min) for a typical ~16× range.
  const [zoom, setZoom] = useState(0);
  const pinch = useRef({ startDist: 0, startZoom: 0, zoom: 0 }).current;
  pinch.zoom = zoom;
  const pinchResponder = useRef(
    PanResponder.create({
      // Only two-finger touches: single taps fall through to the camera and buttons.
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        pinch.startDist = touchDistance(e);
        pinch.startZoom = pinch.zoom;
      },
      onPanResponderMove: (e) => {
        const dist = touchDistance(e);
        if (!dist) return;
        // A second finger that lands after the grant starts the pinch here.
        if (!pinch.startDist) {
          pinch.startDist = dist;
          pinch.startZoom = pinch.zoom;
          return;
        }
        const next = pinch.startZoom + Math.log(dist / pinch.startDist) * ZOOM_PER_LN;
        setZoom(Math.min(1, Math.max(0, next)));
      },
      onPanResponderRelease: () => {
        pinch.startDist = 0;
      },
      onPanResponderTerminate: () => {
        pinch.startDist = 0;
      },
    }),
  ).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const reticleRotate = useRef(new Animated.Value(0)).current;

  // Loops run until stopped, also after the screen is gone: stop them on unmount.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (phase !== 'analyzing') return;
    const loop = Animated.loop(
      Animated.timing(reticleRotate, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
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
        const classifyFn = selectScanClassifier({
          useNativeVision: USE_NATIVE_VISION,
          executorch,
          fallback: isWeb ? vision : undefined,
        });
        if (!classifyFn) {
          // Pack installed but the model isn't loaded yet: say so, don't guess.
          haptics.warning();
          showToast({ text: t('scan.modelNotReady'), icon: '⏳', bg: PB.yellow });
          setPhase('aim');
          return;
        }
        candidates = await classifyFn(photoUri, { hint, topK: 3 });
      } catch {
        candidates = [];
      }
      const minHold = 2200 - (Date.now() - startedAt);
      setTimeout(() => {
        // Anything under the user's floor can't be added to the Dex at all.
        const floor = minConfidence / 100;
        const viable = candidates.filter((c) => c.confidence >= floor);
        const top = viable[0];
        const second = viable[1];
        const confident =
          top &&
          top.confidence >= Math.max(0.7, floor) &&
          (!second || top.confidence - second.confidence >= 0.15);

        if (confident && top) {
          haptics.success();
          go('result', {
            id: top.bugId,
            conf: Math.round(top.confidence * 100),
            ...(photoUri ? { photoUri } : {}),
          });
        } else if (viable.length >= 2) {
          haptics.select();
          go('disambiguate', {
            candidates: viable.map((c) => c.bugId),
            confs: viable.map((c) => Math.round(c.confidence * 100)),
            ...(photoUri ? { photoUri } : {}),
          });
        } else if (top) {
          // One plausible species above the floor, just not a sure one: show it with its confidence.
          haptics.select();
          go('result', {
            id: top.bugId,
            conf: Math.round(top.confidence * 100),
            ...(photoUri ? { photoUri } : {}),
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
    if (needsPack) {
      haptics.warning();
      return;
    }
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
    if (needsPack) {
      haptics.warning();
      return;
    }
    // The system photo picker needs no library permission (iOS PHPicker, Android photo
    // picker); asking first made a once-denied prompt silently kill this button.
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const photoUri = result.assets[0]?.uri ?? null;
      haptics.tap();
      setPhase('analyzing');
      classifyAndRoute(photoUri);
    } catch {
      haptics.warning();
      showToast({ text: t('scan.galleryFailed'), icon: '⚠️', bg: PB.red });
    }
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
    // Pinch handlers on the root: touches bubble up through ancestors only, so a sibling layer
    // under the overlays (focus box, tip card) would never see them.
    <View style={styles.root} {...(cameraReady ? pinchResponder.panHandlers : {})}>
      {cameraReady ? (
        <CameraView
          ref={(ref) => {
            cameraRef.current = ref;
          }}
          style={StyleSheet.absoluteFill}
          facing="back"
          mute
          zoom={zoom}
        />
      ) : (
        <CameraScene />
      )}

      {zoom > 0.01 && (
        // Zoomed in: a tap goes back to the full view.
        <View style={styles.zoomWrap} pointerEvents="box-none">
          <Pressable onPress={() => setZoom(0)} style={styles.zoomChip}>
            <Text style={styles.zoomText}>↺ 1×</Text>
          </Pressable>
        </View>
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
        <View style={{ width: 42 }} />
      </View>

      {!cameraReady && permission && !needsPack && (
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

      {needsPack && (
        <View style={styles.permissionCard}>
          <Sticker bg={PB.cream} rotate={-1} style={{ padding: 16 }}>
            <Text style={styles.permissionTitle}>{t('scan.needPackTitle')}</Text>
            <Text style={styles.permissionDesc}>{t('scan.needPackBody')}</Text>
            <Btn full bg={PB.ink} color={PB.yellow} onPress={() => go('settings')} style={{ marginTop: 12 }}>
              {t('scan.needPackCta')}
            </Btn>
          </Sticker>
        </View>
      )}

      {modelLoading && (
        <View style={styles.modelBanner}>
          <Text style={styles.modelBannerText}>
            {executorch.downloadProgress > 0
              ? t('scan.modelFetching', { pct: Math.round(executorch.downloadProgress * 100) })
              : t('scan.modelLoading')}
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

      {(tipVisible || phase === 'analyzing') && (
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
      )}

      <View style={styles.bottomRow}>
        <IconBtn size={48} fs={22} onPress={pickFromGallery}>🖼️</IconBtn>
        <Pressable onPress={shutter} style={[styles.shutter, phase !== 'aim' && styles.shutterPressed]}>
          <View style={styles.shutterInner} />
        </Pressable>
        <IconBtn size={48} fs={22} onPress={() => setTipsOpen(true)} accessibilityLabel={t('scan.tipsTitle')}>💡</IconBtn>
      </View>

      <PhotoTipsDialog visible={tipsOpen} onClose={() => setTipsOpen(false)} />

      <TabBar active="scan" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: PB.ink, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,12,8,0.5)' },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: '#fff', zIndex: 60 },
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
  zoomWrap: { position: 'absolute', top: 104, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  zoomChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  zoomText: { fontSize: 13, fontWeight: '800', color: PB.ink },
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
  tipWrap: { position: 'absolute', bottom: 222, left: 12, right: 12, zIndex: 10 },
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
    bottom: 118, // clears the tab bar (28 + 70)
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
    bottom: 300,
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
