import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
  type MapRef,
  type CameraRef,
} from "@maplibre/maplibre-react-native";

import { cachedPmtilesInfo, readPmtilesInfo, type PackInfo } from "@/map/mapPack";
import { buildStickerStyle, toPmtilesUrl, NODATA_PATTERN, POI_ICONS, WATER_PATTERN } from "@/map/stickerStyle";
import { altitudeToZoom, minZoomForBounds, type MapInitialView, type Marker } from "@/screens/mapGeo";
import { PB } from "@/tokens/pb";

const CATCH_PIN = "catch-pin";

// Module-level so `<Images>` gets a stable object across renders.
const MAP_IMAGES = {
  // Drawn by tools/map/gen_pixel_icons.py: a pixel bug on a sticker disc.
  [CATCH_PIN]: require("../../assets/map/pin-catch.png"),
  [WATER_PATTERN]: require("../../assets/map/water-wave.png"),
  [NODATA_PATTERN]: require("../../assets/map/nodata.png"),
  [POI_ICONS.tree]: require("../../assets/map/poi-tree.png"),
  [POI_ICONS.flower]: require("../../assets/map/poi-flower.png"),
  [POI_ICONS.peak]: require("../../assets/map/poi-peak.png"),
};

export type OfflineMapHandle = {
  flyTo: (lng: number, lat: number, altM?: number) => void;
  /** Zoom by `delta` levels around the current centre (negative zooms out). */
  zoomBy: (delta: number) => void;
};

const MIN_ZOOM = 1;
// Vector tiles over-zoom gracefully, but only so far: allow a few levels past the pack's deepest.
const OVERZOOM_LEVELS = 3;
const FALLBACK_MAX_ZOOM = 10;

type Props = {
  /** Local file URI of the region's PMTiles map (it is already on the device). */
  packUri: string;
  markers: Marker[];
  initialView: MapInitialView;
  onMarkerClick?: (marker: Marker) => boolean | void;
};

/**
 * Offline 2D map: MapLibre Native rendering a local PMTiles pack with the
 * sticker style.
 */
export const OfflineMap = React.forwardRef<OfflineMapHandle, Props>(
  function OfflineMap({ packUri, markers, initialView, onMarkerClick }, ref) {
    const cameraRef = useRef<CameraRef>(null);
    const tilesUrl = useMemo(() => toPmtilesUrl(packUri), [packUri]);
    const mapRef = useRef<MapRef>(null);

    // Coverage + depth of the local pack, from its header. Normally already read by the
    // installed-map check, so the style is built once, not again when the header arrives.
    const [info, setInfo] = useState<PackInfo | null>(() => cachedPmtilesInfo(packUri) ?? null);
    useEffect(() => {
      const cached = cachedPmtilesInfo(packUri);
      if (cached) return setInfo(cached);
      let cancelled = false;
      void readPmtilesInfo(packUri).then((b) => {
        if (!cancelled) setInfo(b);
      });
      return () => { cancelled = true; };
    }, [packUri]);

    // Catches as one GeoJSON source drawn by the map itself: a React view per pin got slow with
    // hundreds of catches (each a native view tracking the camera, each with an SVG inside).
    const markerData = useMemo<GeoJSON.FeatureCollection>(
      () => ({
        type: "FeatureCollection",
        features: markers.map((m) => ({
          type: "Feature",
          id: m.id,
          properties: { id: m.id, you: m.id === "you" },
          geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        })),
      }),
      [markers],
    );


    const mapStyle = useMemo(() => buildStickerStyle(tilesUrl, info), [tilesUrl, info]);
    const maxZoom = info ? info.maxZoom + OVERZOOM_LEVELS : FALLBACK_MAX_ZOOM;
    // The map can't leave the pack's coverage: no panning past it, no zooming out to the empty margin.
    const maxBounds = useMemo<[number, number, number, number] | undefined>(
      () => (info ? [info.minLng, info.minLat, info.maxLng, info.maxLat] : undefined),
      [info],
    );
    const minZoom = useMemo(() => {
      if (!info) return MIN_ZOOM;
      const { width, height } = Dimensions.get("window");
      return Math.max(MIN_ZOOM, minZoomForBounds(info, width, height));
    }, [info]);

    // Only the first view seeds the camera; later changes go through flyTo.
    const [initialViewState] = useState(() => ({
      center: [initialView.lng, initialView.lat] as [number, number],
      zoom: altitudeToZoom(initialView.altM, initialView.lat),
    }));

    useImperativeHandle(ref, () => ({
      flyTo(lng, lat, altM = initialView.altM) {
        cameraRef.current?.flyTo({
          center: [lng, lat],
          zoom: altitudeToZoom(altM, lat),
          duration: 1200,
        });
      },
      async zoomBy(delta) {
        const current = await mapRef.current?.getZoom();
        if (current === undefined) return;
        const zoom = Math.min(maxZoom, Math.max(minZoom, Math.round(current + delta)));
        cameraRef.current?.zoomTo(zoom, { duration: 300 });
      },
    }));

    return (
      <View style={StyleSheet.absoluteFill}>
        <MapLibreMap
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          compass={false}
          touchPitch={false}
          attributionPosition={{ top: 120, right: 12 }}
        >
          <Images images={MAP_IMAGES} />
          <Camera
            ref={cameraRef}
            initialViewState={initialViewState}
            minZoom={minZoom}
            maxZoom={maxZoom}
            maxBounds={maxBounds}
          />
          <GeoJSONSource
            id="markers"
            data={markerData}
            onPress={(e) => {
              e.stopPropagation();
              const id = e.nativeEvent.features[0]?.properties?.id;
              const marker = markers.find((m) => m.id === id);
              if (marker) onMarkerClick?.(marker);
            }}
          >
            <Layer
              id="catch-pins"
              type="symbol"
              filter={["!", ["get", "you"]]}
              layout={{
                "icon-image": CATCH_PIN,
                // Pins never hide each other or the map's POI icons.
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              }}
            />
            <Layer
              id="you"
              type="circle"
              filter={["get", "you"]}
              paint={{
                "circle-radius": 6, // + 3 px ring = the old 18 px dot
                "circle-color": PB.red,
                "circle-stroke-width": 3,
                "circle-stroke-color": PB.cream,
              }}
            />
          </GeoJSONSource>
        </MapLibreMap>
      </View>
    );
  },
);
