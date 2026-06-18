import { Asset } from "expo-asset";
import React, {
  createElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "react-cartoon-planet/style.css";
import {
  CartoonPlanet,
  EARTH_MAP,
  flattenGeoJsonToContinents,
  SURFACE_RENDER_MODE,
  type CartoonPlanetController,
  type Marker,
  type PlanetMapDefinition,
} from "react-cartoon-planet";

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
  require("react-cartoon-planet/dist/earth-land-X6JGJZKC.geojson"),
);

async function resolveWebEarthMap(): Promise<PlanetMapDefinition> {
  await earthGeoAsset.downloadAsync();
  const response = await fetch(earthGeoAsset.uri);
  if (!response.ok) {
    throw new Error(`Failed to load earth map (${response.status})`);
  }
  const geo = await response.json();
  return critterboardEarthMap(
    {
      ...EARTH_MAP,
      continents: flattenGeoJsonToContinents(geo, EARTH_MAP.landColor),
    },
    earthGeoAsset.uri,
  );
}

function toInitialCamera(view: MapInitialView) {
  return { lng: view.lng, lat: view.lat, alt_m: view.altM };
}

export const CartoonPlanetGlobe = React.forwardRef<
  CartoonPlanetGlobeHandle,
  Props
>(function CartoonPlanetGlobe(
  { markers, initialView, onMarkerClick },
  ref,
) {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const initialViewRef = useRef(initialView);
  const initialCameraRef = useRef(toInitialCamera(initialView));
  const lastFlownKeyRef = useRef<string | null>(null);
  const [earthMap, setEarthMap] = useState<PlanetMapDefinition | null>(null);

  initialViewRef.current = initialView;

  useEffect(() => {
    let cancelled = false;
    void resolveWebEarthMap().then((map) => {
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

  // The globe mounts at `initialCamera` (first view). When the view changes
  // later — e.g. geolocation resolves and we can frame the user — fly there.
  // Skip the very first run so we don't fight the initial camera placement.
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

  if (!earthMap) {
    return createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0e1a",
      },
    });
  }

  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      },
    },
    createElement(CartoonPlanet, {
      key: "critterboard-globe",
      ref: controllerRef,
      style: { width: "100%", height: "100%" },
      maps: [earthMap],
      initialState: {
        map: earthMap,
        renderMode: SURFACE_RENDER_MODE,
        markers,
        linksEnabled: false,
        initialCamera: initialCameraRef.current,
      },
      bloom: false,
      dayNight: false,
      clouds: false,
      onMarkerClick,
      onReady: (controller) => {
        controllerRef.current = controller;
      },
    }),
  );
});
