import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BugIcon } from "@/components/BugIcon";
import { IconBtn } from "@/components/IconBtn";
import { MapLocked } from "@/components/MapLocked";
import { OfflineMap, type OfflineMapHandle } from "@/components/OfflineMap";
import { Sticker } from "@/components/Sticker";
import { TabBar } from "@/components/TabBar";
import { useNearbySightings } from "@/backend/hooks";
import type { Sighting } from "@/backend";
import { findBug } from "@/data/bugs";
import { bugName, useT } from "@/i18n/helpers";
import { timeAgo } from "@/lib/timeAgo";
import { refreshMapLocation } from "@/lib/geocode";
import { useGeotaggedCatches } from "@/lib/useStreak";
import { REGIONS } from "@/data/regions";
import { useRegionMap } from "@/map/useRegionMap";
import { PB } from "@/tokens/pb";
import { useAppStore, useCurrentRoute } from "@/store/useAppStore";
import { useNav } from "@/store/useNav";

import {
  LOCAL_VIEW_ALT_M,
  buildGlobeMarkers,
  pinsNear,
  buildUserPins,
  resolveInitialMapView,
  resolveMapCenter,
  type UserPinData,
} from "./mapGeo";

export function MapScreen() {
  const { go } = useNav();
  const t = useT();
  const focus = (useCurrentRoute().params as { focus?: { lat: number; lng: number } } | undefined)?.focus;
  const userCatches = useGeotaggedCatches();
  const mapLocation = useAppStore((state) => state.mapLocation);
  const language = useAppStore((state) => state.language);
  const removeMapPin = useAppStore((state) => state.removeMapPin);
  const [selectedPin, setSelectedPin] = useState<UserPinData | null>(null);
  // Pins hidden behind the selected one (same spot): the card cycles through them.
  const [stack, setStack] = useState<UserPinData[]>([]);
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);
  // Other players' shared catches near you (Brains → "Show others' sightings").
  const sightings = useNearbySightings();
  const globeRef = useRef<OfflineMapHandle>(null);

  // The map belongs to the active regional pack and is off until its file is on the device.
  const activeRegion = useAppStore((state) => state.activeRegion);
  const { state: mapState, download: downloadMap } = useRegionMap(activeRegion);
  const region = REGIONS.find((r) => r.id === activeRegion);

  useEffect(() => {
    void refreshMapLocation();
  }, []);

  const headerLocName =
    mapLocation && (mapLocation.city || mapLocation.region)
      ? [mapLocation.city, mapLocation.region].filter(Boolean).join(", ")
      : t("map.locName");

  const center = useMemo(
    () => resolveMapCenter(mapLocation, userCatches),
    [mapLocation, userCatches],
  );

  const userPins = useMemo(
    () => buildUserPins(userCatches, center, (id) => bugName(language, id)),
    [userCatches, center, language],
  );

  const cycle = (step: number) => {
    if (!selectedPin || stack.length < 2) return;
    const i = stack.findIndex((p) => p.id === selectedPin.id);
    setSelectedPin(stack[(i + step + stack.length) % stack.length]!);
  };

  const { markers, meta } = useMemo(
    () => buildGlobeMarkers(userPins, mapLocation),
    [userPins, mapLocation],
  );

  const initialView = useMemo(
    () =>
      focus
        ? { lng: focus.lng, lat: focus.lat, altM: LOCAL_VIEW_ALT_M }
        : resolveInitialMapView(markers, mapLocation, center),
    [focus, markers, mapLocation, center],
  );

  // The first location fix usually lands after the map is already up. Not when opened on a focus point.
  const hadLocation = useRef(mapLocation !== null || focus !== undefined);
  useEffect(() => {
    if (!mapLocation || hadLocation.current) return;
    hadLocation.current = true;
    globeRef.current?.flyTo(mapLocation.lng, mapLocation.lat, LOCAL_VIEW_ALT_M);
  }, [mapLocation]);

  const recenter = () => {
    if (mapLocation) {
      globeRef.current?.flyTo(mapLocation.lng, mapLocation.lat, LOCAL_VIEW_ALT_M);
      return;
    }
    globeRef.current?.flyTo(initialView.lng, initialView.lat, initialView.altM);
  };

  return (
    <View style={styles.root}>
      {mapState.kind !== "ready" ? (
        <MapLocked
          state={mapState}
          regionName={activeRegion ? t(`regions.list.${activeRegion}.name`) : ""}
          mapMb={region?.mapSize ?? 0}
          onDownload={downloadMap}
          onOpenBrains={() => go("settings")}
        />
      ) : (
      <OfflineMap
        ref={globeRef}
        packUri={mapState.fileUri}
        markers={markers}
        sightings={sightings}
        onSightingClick={(x) => {
          setSelectedPin(null);
          setSelectedSighting(x);
        }}
        initialView={initialView}
        onMarkerClick={(marker) => {
          if (marker.id === "you") {
            recenter();
            return false;
          }
          const info = meta.get(marker.id);
          if (info) {
            setSelectedSighting(null);
            setSelectedPin(info.pin);
            setStack(pinsNear(userPins, info.pin));
          }
          return false;
        }}
      />
      )}

      {mapState.kind === "ready" && (
      <View style={styles.zoomCol}>
        <IconBtn
          bg={PB.cream}
          size={44}
          fs={24}
          accessibilityLabel={t("map.zoomIn")}
          onPress={() => globeRef.current?.zoomBy(1)}
        >
          +
        </IconBtn>
        <IconBtn
          bg={PB.cream}
          size={44}
          fs={24}
          accessibilityLabel={t("map.zoomOut")}
          onPress={() => globeRef.current?.zoomBy(-1)}
        >
          −
        </IconBtn>
      </View>
      )}

      <View style={styles.topbar}>
        <Sticker
          bg={PB.cream}
          style={{ paddingVertical: 10, paddingHorizontal: 14 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.locName}>{headerLocName}</Text>
              <Text style={styles.locSub}>
                {t("map.locSub", { n: userPins.length })}
              </Text>
            </View>
            <IconBtn bg={PB.yellow} onPress={recenter}>
              ⌖
            </IconBtn>
          </View>
        </Sticker>
      </View>

      {mapState.kind === "ready" && (
      <View style={styles.bottombar}>
        {selectedPin ? (
          <Sticker bg={PB.cream} style={{ padding: 12 }}>
            <View style={styles.cardRow}>
              <View style={styles.cardArt}>
                <BugIcon bug={{ id: selectedPin.bugId, emoji: selectedPin.emoji }} size={44} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{selectedPin.name}</Text>
                <Text style={styles.cardWhere}>
                  {selectedPin.lat.toFixed(4)}°, {selectedPin.lng.toFixed(4)}°
                </Text>
                {stack.length > 1 ? (
                  <View style={styles.stackRow}>
                    <Pressable onPress={() => cycle(-1)} hitSlop={8} style={styles.stackBtn}>
                      <Text style={styles.stackBtnText}>‹</Text>
                    </Pressable>
                    <Text style={styles.cardWhere}>
                      {t("map.stackOf", { n: stack.findIndex((p) => p.id === selectedPin.id) + 1, total: stack.length })}
                    </Text>
                    <Pressable onPress={() => cycle(1)} hitSlop={8} style={styles.stackBtn}>
                      <Text style={styles.stackBtnText}>›</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 6 }}>
                <Pressable
                  onPress={() => go("result", { id: selectedPin.bugId })}
                  style={styles.huntPill}
                >
                  <Text style={styles.huntPillText}>{t("map.viewInsect")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    removeMapPin(selectedPin.at);
                    const rest = stack.filter((x) => x.id !== selectedPin.id);
                    setStack(rest);
                    setSelectedPin(rest[0] ?? null);
                  }}
                  style={styles.removePill}
                >
                  <Text style={styles.removePillText}>
                    {t("map.pinRemove")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedPin(null)}
                  style={styles.closePill}
                >
                  <Text style={styles.closePillText}>✕</Text>
                </Pressable>
              </View>
            </View>
          </Sticker>
        ) : selectedSighting ? (
          // Someone else's catch: what and when, never who.
          <Sticker bg={PB.cream} style={{ padding: 12 }}>
            <View style={styles.cardRow}>
              <View style={styles.cardArt}>
                <BugIcon bug={{ id: selectedSighting.bugId, emoji: findBug(selectedSighting.bugId)?.emoji ?? "🐛" }} size={44} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{bugName(language, selectedSighting.bugId)}</Text>
                <Text style={styles.cardWhere}>
                  {t("map.sightingSub", { when: timeAgo(selectedSighting.at, language) })}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable
                  onPress={() => go("result", { id: selectedSighting.bugId })}
                  style={styles.huntPill}
                >
                  <Text style={styles.huntPillText}>{t("map.viewInsect")}</Text>
                </Pressable>
                <Pressable onPress={() => setSelectedSighting(null)} style={styles.closePill}>
                  <Text style={styles.closePillText}>✕</Text>
                </Pressable>
              </View>
            </View>
          </Sticker>
        ) : userPins.length === 0 && sightings.length === 0 ? (
          // Only when there are no pins: with pins, nothing is shown until one is tapped.
          <Sticker bg={PB.cream} style={{ padding: 12 }}>
            <View style={styles.cardRow}>
              <View style={styles.cardArt}>
                <Text style={{ fontSize: 26 }}>📍</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t("map.emptyTitle")}</Text>
                <Text style={styles.cardWhere}>{t("map.emptySub")}</Text>
              </View>
            </View>
          </Sticker>
        ) : null}
      </View>
      )}

      <TabBar active="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: PB.blue },
  zoomCol: { position: "absolute", right: 12, bottom: 250, gap: 8, zIndex: 2 },
  topbar: { position: "absolute", top: 50, left: 12, right: 12, zIndex: 2 },
  locName: { fontSize: 18, fontWeight: "800", color: PB.ink, lineHeight: 18 },
  locSub: { fontSize: 11, color: PB.ink, opacity: 0.6, marginTop: 2 },
  bottombar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 110,
    zIndex: 2,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardArt: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.cream2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: PB.ink },
  cardWhere: { fontSize: 13, color: PB.ink, fontWeight: "600" },
  huntPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  huntPillText: { fontSize: 11, fontWeight: "800", color: PB.ink },
  stackRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  stackBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: PB.ink,
    backgroundColor: PB.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  stackBtnText: { fontSize: 16, fontWeight: "900", color: PB.ink, lineHeight: 18 },
  removePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.red,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    alignItems: "center",
  },
  removePillText: { fontSize: 11, fontWeight: "800", color: PB.cream },
  closePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    alignItems: "center",
  },
  closePillText: { fontSize: 11, fontWeight: "800", color: PB.ink },
});
