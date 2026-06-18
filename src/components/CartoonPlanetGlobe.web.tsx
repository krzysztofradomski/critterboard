import React, {
  createElement,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import "react-cartoon-planet/style.css";
import {
  CartoonPlanet,
  EARTH_MAP,
  SURFACE_RENDER_MODE,
  type CartoonPlanetController,
  type Marker,
} from "react-cartoon-planet";

export type CartoonPlanetGlobeHandle = {
  flyTo: (lng: number, lat: number, altM?: number) => void;
};

type Props = {
  markers: Marker[];
  center: { lat: number; lng: number } | null;
  onMarkerClick?: (marker: Marker) => boolean | void;
};

export const CartoonPlanetGlobe = React.forwardRef<
  CartoonPlanetGlobeHandle,
  Props
>(function CartoonPlanetGlobe({ markers, center, onMarkerClick }, ref) {
  const controllerRef = useRef<CartoonPlanetController | null>(null);
  const centeredRef = useRef(false);

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, altM = 900_000) {
      controllerRef.current?.flyTo(lng, lat, altM, { duration: 1200 });
    },
  }));

  useEffect(() => {
    if (!center || centeredRef.current || !controllerRef.current) return;
    centeredRef.current = true;
    controllerRef.current.flyTo(center.lng, center.lat, 900_000, {
      duration: 1400,
    });
  }, [center]);

  useEffect(() => {
    controllerRef.current?.setMarkers(markers);
  }, [markers]);

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
      ref: controllerRef,
      style: { width: "100%", height: "100%" },
      maps: [EARTH_MAP],
      initialState: {
        map: EARTH_MAP,
        renderMode: SURFACE_RENDER_MODE,
        startView: "globe",
        markers,
      },
      dayNight: true,
      clouds: true,
      onMarkerClick,
      onReady: (controller) => {
        controllerRef.current = controller;
        if (center && !centeredRef.current) {
          centeredRef.current = true;
          controller.flyTo(center.lng, center.lat, 900_000, { duration: 1400 });
        }
      },
    }),
  );
});
