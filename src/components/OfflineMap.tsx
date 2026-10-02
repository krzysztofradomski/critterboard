import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import {
  Camera,
  Images,
  Map as MapLibreMap,
  type MapRef,
  Marker as MapMarker,
  type CameraRef,
} from "@maplibre/maplibre-react-native";

import { PixelBug } from "@/components/PixelBug";
import { readPmtilesInfo, type PackInfo } from "@/map/mapPack";
import { buildStickerStyle, toPmtilesUrl, NODATA_PATTERN, POI_ICONS, WATER_PATTERN } from "@/map/stickerStyle";
import { altitudeToZoom, minZoomForBounds, type MapInitialView, type Marker } from "@/screens/mapGeo";
import { PB } from "@/tokens/pb";

// Module-level so `<Images>` gets a stable object across renders.
const MAP_IMAGES = {
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

    // Coverage + depth of the local pack, from its header.
    const [info, setInfo] = useState<PackInfo | null>(null);
    useEffect(() => {
      let cancelled = false;
      void readPmtilesInfo(tilesUrl.replace(/^pmtiles:\/\//, "")).then((b) => {
        if (!cancelled) setInfo(b);
      });
      return () => { cancelled = true; };
    }, [tilesUrl]);


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
          {markers.map((m) => (
            <MapMarker
              key={m.id}
              id={m.id}
              lngLat={[m.lng, m.lat]}
              onPress={() => onMarkerClick?.(m)}
            >
              {m.id === "you" ? (
                <View style={styles.you} />
              ) : (
                <View style={[styles.pin, { backgroundColor: m.color ?? PB.cream }]}>
                  <PixelBug size={24} color={PB.ink} accent={PB.cream} />
                </View>
              )}
            </MapMarker>
          ))}
        </MapLibreMap>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    borderColor: PB.ink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  you: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: PB.cream,
    backgroundColor: PB.red,
  },
});
