import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Asset } from "expo-asset";
import { PixelRatio, StyleSheet, View } from "react-native";
import type { ExpoWebGLRenderingContext } from "expo-gl";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as THREE from "three";
import { flattenGeoJsonToContinents } from "react-cartoon-planet";
import {
  CartoonPlanetNative,
  EARTH_MAP,
  type CartoonPlanetController,
  type GlobeInteractionTarget,
  type Marker,
} from "react-cartoon-planet/native";
import {
  critterboardEarthMap,
  type MapInitialView,
} from "@/screens/mapGeo";

export type CartoonPlanetGlobeHandle = {
  flyTo: (lng: number, lat: number, altM?: number) => void;
};

type Props = {
  markers: Marker[];
  initialView: MapInitialView;
  onMarkerClick?: (marker: Marker) => boolean | void;
};

const earthGeoAsset = Asset.fromModule(
  require("react-cartoon-planet/dist/native/earth-land-X6JGJZKC.geojson"),
);

async function resolveNativeEarthMap(): Promise<
  import("react-cartoon-planet").PlanetMapDefinition
> {
  await earthGeoAsset.downloadAsync();
  const uri = earthGeoAsset.localUri ?? earthGeoAsset.uri;
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to load earth map (${response.status})`);
  }
  const geo = await response.json();
  return critterboardEarthMap(
    {
      ...EARTH_MAP,
      continents: flattenGeoJsonToContinents(geo, EARTH_MAP.landColor),
    },
    uri,
  );
}

const createGlRenderer = (
  gl: ExpoWebGLRenderingContext,
  width: number,
  height: number,
) => {
  const renderer = new THREE.WebGLRenderer({
    context: gl,
    antialias: true,
    alpha: false,
    logarithmicDepthBuffer: true,
    canvas: {
      width,
      height,
      style: {},
      clientWidth: width,
      clientHeight: height,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as HTMLCanvasElement,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(PixelRatio.get());
  renderer.setClearColor(new THREE.Color("#0a0e1a"));
  return renderer;
};

function toInitialCamera(view: MapInitialView) {
  return { lng: view.lng, lat: view.lat, alt_m: view.altM };
}

export const CartoonPlanetGlobe = React.forwardRef<
  CartoonPlanetGlobeHandle,
  Props
>(function CartoonPlanetGlobe({ markers, initialView, onMarkerClick }, ref) {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const interactionRef = useRef<GlobeInteractionTarget | null>(null);
  const initialViewRef = useRef(initialView);
  const initialCameraRef = useRef(toInitialCamera(initialView));
  const lastFlownKeyRef = useRef<string | null>(null);
  const pinchStartScale = useRef(1);
  const [earthMap, setEarthMap] = useState<
    import("react-cartoon-planet").PlanetMapDefinition | null
  >(null);

  initialViewRef.current = initialView;

  useEffect(() => {
    let cancelled = false;
    void resolveNativeEarthMap().then((map) => {
      if (!cancelled) setEarthMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, altM = initialViewRef.current.altM) {
      controllerRef.current?.flyTo(lng, lat, altM, { duration: 1200 });
    },
  }));

  useEffect(() => {
    controllerRef.current?.setMarkers(markers);
  }, [markers]);

  // Mounted at `initialCamera` (first view); fly to later views (e.g. once
  // geolocation resolves). Skip the first run so we don't override the mount.
  useEffect(() => {
    const key = `${initialView.lng.toFixed(4)},${initialView.lat.toFixed(4)},${Math.round(initialView.altM)}`;
    if (lastFlownKeyRef.current !== null && lastFlownKeyRef.current !== key) {
      controllerRef.current?.flyTo(
        initialView.lng,
        initialView.lat,
        initialView.altM,
        { duration: 1200 },
      );
    }
    lastFlownKeyRef.current = key;
  }, [initialView]);

  const dispatch = useCallback(
    (event: Parameters<GlobeInteractionTarget["dispatch"]>[0]) => {
      interactionRef.current?.dispatch(event);
    },
    [],
  );

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      dispatch({
        type: "pointerdown",
        clientX: e.x,
        clientY: e.y,
        pointerId: 1,
      });
    })
    .onUpdate((e) => {
      dispatch({
        type: "pointermove",
        clientX: e.x,
        clientY: e.y,
        pointerId: 1,
      });
    })
    .onEnd((e) => {
      dispatch({
        type: "pointerup",
        clientX: e.x,
        clientY: e.y,
        pointerId: 1,
      });
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchStartScale.current = 1;
    })
    .onUpdate((e) => {
      const delta = (pinchStartScale.current - e.scale) * 120;
      pinchStartScale.current = e.scale;
      dispatch({
        type: "wheel",
        clientX: 0,
        clientY: 0,
        deltaY: delta,
      });
    });

  const tapGesture = Gesture.Tap().onEnd((e) => {
    dispatch({
      type: "click",
      clientX: e.x,
      clientY: e.y,
    });
  });

  const gesture = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  if (!earthMap) {
    return <View style={[styles.fill, { backgroundColor: "#0a0e1a" }]} />;
  }

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <View style={styles.fill}>
          <CartoonPlanetNative
            ref={controllerRef}
            createGlRenderer={createGlRenderer}
            pixelRatio={Math.min(PixelRatio.get(), 2)}
            maps={[earthMap]}
            initialState={{
              map: earthMap,
              markers,
              linksEnabled: false,
              initialCamera: initialCameraRef.current,
            }}
            dayNight={false}
            clouds={false}
            bloom={false}
            onMarkerClick={onMarkerClick}
            onReady={(controller) => {
              controllerRef.current = controller;
            }}
            onInteractionReady={(interaction) => {
              interactionRef.current = interaction;
            }}
          />
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
