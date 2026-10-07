import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import * as FileSystem from 'expo-file-system/legacy';
import { vision, USE_NATIVE_VISION, useExecutorchClassifier, type Candidate } from '@/ai';
import { getModelPath } from '@/data/regionPacks';
import { selectScanClassifier } from '@/ai/scanClassifier';
import { scanCrops, type Aim } from '@/ai/scanCrops';
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
type Shot = { uri: string; fromCamera: boolean };
type Point = { x: number; y: number };

const ZOOM_PER_LN = 0.36;
/** A touch that moves less than this (pt) is a tap, not a drag. */
const TAP_SLOP = 10;
/** Bottom of the top bar and height of the shutter row + tab bar (pt): taps there don't snap. */
const TOP_BAR_BOTTOM = 96;
const CONTROLS_HEIGHT = 210;
/** Reticle size (pt) and centre height (fraction of the screen). The classifier crops around it. */
const RETICLE = 220;
const RETICLE_TOP = 0.46;

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
  const [shot, setShot] = useState<Shot | null>(null);
  const [tapPoint, setTapPoint] = useState<Point | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  // The guide's hint is a greeting, not a status: show it on arrival, then get out of the way.
  const [tipVisible, setTipVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTipVisible(false), 6000);
    return () => clearTimeout(id);
  }, []);
  const [flash, setFlash] = useState(false);
  // Screen size, to find the reticle in the photo. The preview fills this view.
  const view = useRef({ width: 0, height: 0 }).current;
  const onLayout = (e: LayoutChangeEvent) => Object.assign(view, e.nativeEvent.layout);

  // Tap the preview to snap and search around that spot; pinch to zoom. expo-camera's zoom is
  // 0..1 of the lens range; on iOS it is exponential (min × (max/min)^zoom), so adding
  // ln(scale) × ZOOM_PER_LN keeps a pinch feeling the same at every zoom level.
  // ZOOM_PER_LN ≈ 1 / ln(max/min) for a typical ~16× range.
  const [zoom, setZoom] = useState(0);
  const gesture = useRef({ startDist: 0, startZoom: 0, zoom: 0, pinched: false, onTap: (_p: Point) => {} }).current;
  gesture.zoom = zoom;
  const gestureResponder = useRef(
    PanResponder.create({
      // Buttons sit deeper and claim their touches first; every other touch on the screen is the
      // camera's, overlays like the reticle included (sibling layers under them would never see it).
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        gesture.pinched = false;
        gesture.startDist = touchDistance(e);
        gesture.startZoom = gesture.zoom;
      },
      onPanResponderMove: (e) => {
        const dist = touchDistance(e);
        if (!dist) return;
        gesture.pinched = true;
        // A second finger that lands after the grant starts the pinch here.
        if (!gesture.startDist) {
          gesture.startDist = dist;
          gesture.startZoom = gesture.zoom;
          return;
        }
        const next = gesture.startZoom + Math.log(dist / gesture.startDist) * ZOOM_PER_LN;
        setZoom(Math.min(1, Math.max(0, next)));
      },
      onPanResponderRelease: (_e, g) => {
        gesture.startDist = 0;
        // The root fills the screen, so page coordinates are view coordinates.
        if (!gesture.pinched && Math.hypot(g.dx, g.dy) < TAP_SLOP) gesture.onTap({ x: g.x0, y: g.y0 });
      },
      onPanResponderTerminate: () => {
        gesture.startDist = 0;
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
  const classifyAndRoute = (photoUri: string | null, fromCamera: boolean, tap: Point | null = null) => {
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
          setShot(null);
          setTapPoint(null);
          setPhase('aim');
          return;
        }
        // Classify crops around the tap, or search the reticle (camera) / photo centre (gallery),
        // not the whole frame squashed to the model input. The web mock ignores the frame.
        const aim: Aim | undefined = view.width > 0
          ? {
              view,
              fit: fromCamera ? 'cover' : 'contain',
              ...(fromCamera ? { reticle: { cx: view.width / 2, cy: view.height * RETICLE_TOP, side: RETICLE } } : {}),
              ...(tap ? { tap } : {}),
            }
          : undefined;
        const frame = photoUri && !isWeb ? await scanCrops(photoUri, aim) : photoUri;
        candidates = await classifyFn(frame, { hint, topK: 3 });
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

  /** Freeze the photo on screen and classify it: around `tap`, or auto search when null. */
  const analyse = (next: Shot, tap: Point | null) => {
    setShot(next);
    setTapPoint(tap);
    setPhase('analyzing');
    classifyAndRoute(next.uri, next.fromCamera, tap);
  };

  /** Snap a photo; `tap` (a tap on the preview) aims the search, else the reticle does. */
  const shutter = async (tap: Point | null = null) => {
    if (phase !== 'aim') return;
    if (needsPack) {
      haptics.warning();
      return;
    }
    haptics.tap();
    setFlash(true);
    setPhase('flash');
    setTimeout(() => setFlash(false), 180);

    // Snap a real photo if the camera is mounted; fall back to a null URI
    // (the mock classifier doesn't care) when running on simulator/web.
    let photoUri: string | null = null;
    try {
      const result = await cameraRef.current?.takePictureAsync({
        // No skipProcessing: processing crops the photo to the preview (so the reticle maps onto
        // it) and records its true orientation. Raw sensor output can come back rotated.
        quality: 0.85,
      });
      photoUri = result?.uri ?? null;
    } catch {
      photoUri = null;
    }
    if (photoUri && !isWeb) {
      analyse({ uri: photoUri, fromCamera: true }, tap);
      return;
    }
    setPhase('analyzing');
    classifyAndRoute(photoUri, true);
  };
  // Taps on the top bar or the shutter row / tab bar background aren't aimed at a bug.
  gesture.onTap = (p) => {
    if (p.y > TOP_BAR_BOTTOM && p.y < view.height - CONTROLS_HEIGHT) void shutter(p);
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
      if (photoUri && !isWeb) {
        analyse({ uri: photoUri, fromCamera: false }, null);
        return;
      }
      setPhase('analyzing');
      classifyAndRoute(photoUri, false);
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
    // Tap and pinch handlers on the root: touches bubble up through ancestors only, so a sibling
    // layer under the overlays (focus box, tip card) would never see them.
    <View style={styles.root} onLayout={onLayout} {...(cameraReady ? gestureResponder.panHandlers : {})}>
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

      {shot && phase === 'analyzing' && (
        // The frozen photo, shown as the preview showed it (camera) or whole (gallery), so the
        // tap ring sits where the search looks (scanCrops' `fit`).
        <View style={[StyleSheet.absoluteFill, styles.shotLayer]} pointerEvents="none">
          <Image
            source={{ uri: shot.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode={shot.fromCamera ? 'cover' : 'contain'}
          />
        </View>
      )}

      {zoom > 0.01 && phase === 'aim' && (
        // Zoomed in: a tap goes back to the full view.
        <View style={styles.zoomWrap} pointerEvents="box-none">
          <Pressable onPress={() => setZoom(0)} style={styles.zoomChip}>
            <Text style={styles.zoomText}>↺ 1×</Text>
          </Pressable>
        </View>
      )}

      {phase === 'analyzing' && <View style={styles.tint} />}
      {tapPoint && <View pointerEvents="none" style={[styles.tapRing, { left: tapPoint.x - 36, top: tapPoint.y - 36 }]} />}
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

      {!tapPoint && (
      <Animated.View
        style={[
          styles.reticle,
          {
            borderColor: phase === 'analyzing' ? PB.pink : PB.yellow,
            transform: [
              { translateX: -RETICLE / 2 },
              { translateY: -RETICLE / 2 },
              {
                rotate: reticleRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
              },
            ],
          },
        ]}
      >
        <View style={styles.focusTag}>
          <Text style={styles.focusTagText}>
            {phase === 'analyzing' ? t('scan.matching') : t('scan.tapToSnap')}
          </Text>
        </View>
      </Animated.View>
      )}

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
        <Pressable onPress={() => void shutter()} style={[styles.shutter, phase !== 'aim' && styles.shutterPressed]}>
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
  shotLayer: { backgroundColor: PB.ink },
  tapRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: PB.pink,
  },
  reticle: {
    position: 'absolute',
    left: '50%',
    top: `${RETICLE_TOP * 100}%`,
    width: RETICLE,
    height: RETICLE,
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
