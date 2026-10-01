import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Camera,
  Images,
  Map as MapLibreMap,
  Marker as MapMarker,
  type CameraRef,
} from "@maplibre/maplibre-react-native";

import { PixelBug } from "@/components/PixelBug";
import { useT } from "@/i18n/helpers";
import {
  DEV_MAP_PACK_ID,
  devMapPackUrl,
  downloadMapPack,
  installedMapPack,
} from "@/map/mapPack";
import { buildStickerStyle, toPmtilesUrl, POI_ICONS, WATER_PATTERN } from "@/map/stickerStyle";
import { altitudeToZoom, type MapInitialView, type Marker } from "@/screens/mapGeo";
import { PB } from "@/tokens/pb";

// Module-level so `<Images>` gets a stable object across renders.
const MAP_IMAGES = {
  [WATER_PATTERN]: require("../../assets/map/water-wave.png"),
  [POI_ICONS.tree]: require("../../assets/map/poi-tree.png"),
  [POI_ICONS.flower]: require("../../assets/map/poi-flower.png"),
  [POI_ICONS.peak]: require("../../assets/map/poi-peak.png"),
};

export type OfflineMapHandle = {
  flyTo: (lng: number, lat: number, altM?: number) => void;
};

type Props = {
  markers: Marker[];
  initialView: MapInitialView;
  onMarkerClick?: (marker: Marker) => boolean | void;
};

type PackState =
  | { kind: "loading" }
  | { kind: "ready"; tilesUrl: string }
  | { kind: "downloading"; pct: number }
  | { kind: "missing" }
  | { kind: "error"; message: string };

/** Resolve the local PMTiles pack, downloading it once if a URL is configured. */
function useMapPack(): PackState {
  const [state, setState] = useState<PackState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const set = (s: PackState) => { if (!cancelled) setState(s); };

    void (async () => {
      const local = await installedMapPack(DEV_MAP_PACK_ID);
      if (local) return set({ kind: "ready", tilesUrl: toPmtilesUrl(local) });

      const url = devMapPackUrl();
      if (!url) return set({ kind: "missing" });

      try {
        set({ kind: "downloading", pct: 0 });
        const path = await downloadMapPack(DEV_MAP_PACK_ID, url, (pct) =>
          set({ kind: "downloading", pct }),
        );
        set({ kind: "ready", tilesUrl: toPmtilesUrl(path) });
      } catch (e) {
        set({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}

/** User-facing pack status; null once ready (or while the local file is being looked up). */
function statusText(state: PackState, t: ReturnType<typeof useT>): string | null {
  switch (state.kind) {
    case "downloading": return t("map.packDownloading", { pct: state.pct });
    case "missing": return t("map.packMissing");
    case "error": return t("map.packError");
    default: return null;
  }
}

/**
 * Offline 2D map: MapLibre Native rendering a local PMTiles pack with the
 * sticker style.
 */
export const OfflineMap = React.forwardRef<OfflineMapHandle, Props>(
  function OfflineMap({ markers, initialView, onMarkerClick }, ref) {
    const cameraRef = useRef<CameraRef>(null);
    const t = useT();
    const pack = useMapPack();
    const tilesUrl = pack.kind === "ready" ? pack.tilesUrl : null;
    const mapStyle = useMemo(() => buildStickerStyle(tilesUrl), [tilesUrl]);

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
    }));

    const status = statusText(pack, t);

    return (
      <View style={StyleSheet.absoluteFill}>
        <MapLibreMap
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          compass={false}
          touchPitch={false}
          attributionPosition={{ top: 120, right: 12 }}
        >
          <Images images={MAP_IMAGES} />
          <Camera ref={cameraRef} initialViewState={initialViewState} />
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
        {status ? (
          <View style={styles.status} pointerEvents="none">
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}
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
  status: {
    position: "absolute",
    top: 130,
    left: 12,
    right: 12,
    padding: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PB.ink,
    backgroundColor: PB.cream,
  },
  statusText: { fontSize: 12, fontWeight: "700", color: PB.ink },
});
