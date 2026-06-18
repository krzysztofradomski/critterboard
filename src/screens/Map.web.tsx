import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  CartoonPlanetGlobe,
  type CartoonPlanetGlobeHandle,
} from "@/components/CartoonPlanetGlobe.web";
import { IconBtn } from "@/components/IconBtn";
import { Sticker } from "@/components/Sticker";
import { TabBar } from "@/components/TabBar";
import { SIGHTINGS } from "@/data/sightings";
import { bugName, useT } from "@/i18n/helpers";
import { refreshMapLocation } from "@/lib/geocode";
import { useGeotaggedCatches } from "@/lib/useStreak";
import { PB } from "@/tokens/pb";
import { useAppStore } from "@/store/useAppStore";
import { useNav } from "@/store/useNav";

import {
  buildGlobeMarkers,
  buildUserPins,
  resolveInitialMapView,
  resolveMapCenter,
  type UserPinData,
} from "./mapGeo";

export function MapScreen() {
  const { go } = useNav();
  const t = useT();
  const [selected, setSelected] = useState(2);
  const s = SIGHTINGS[selected]!;
  const userCatches = useGeotaggedCatches();
  const locationShareOn = useAppStore((state) => state.profile.locationShareOn);
  const mapLocation = useAppStore((state) => state.mapLocation);
  const language = useAppStore((state) => state.language);
  const removeMapPin = useAppStore((state) => state.removeMapPin);
  const [selectedPin, setSelectedPin] = useState<UserPinData | null>(null);
  const globeRef = useRef<CartoonPlanetGlobeHandle>(null);

  useEffect(() => {
    void refreshMapLocation();
  }, [locationShareOn]);

  const headerLocName = !locationShareOn
    ? t("map.locNamePrivate")
    : mapLocation && (mapLocation.city || mapLocation.region)
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

  const { markers, meta } = useMemo(
    () => buildGlobeMarkers(center, userPins, mapLocation),
    [center, userPins, mapLocation],
  );

  const initialView = useMemo(
    () => resolveInitialMapView(markers, mapLocation, center),
    [markers, mapLocation, center],
  );

  const recenter = () => {
    if (mapLocation) {
      globeRef.current?.flyTo(mapLocation.lng, mapLocation.lat, 400_000);
      return;
    }
    globeRef.current?.flyTo(initialView.lng, initialView.lat, initialView.altM);
  };

  return (
    <View style={styles.root}>
      <CartoonPlanetGlobe
        ref={globeRef}
        markers={markers}
        initialView={initialView}
        onMarkerClick={(marker) => {
          if (marker.id === "you") {
            recenter();
            return false;
          }
          const info = meta.get(marker.id);
          if (!info) return false;
          if (info.kind === "sighting") {
            setSelected(info.index);
            setSelectedPin(null);
          } else {
            setSelectedPin(info.pin);
          }
          return false;
        }}
      />

      <View style={styles.topbar}>
        <Sticker
          bg={PB.cream}
          style={{ paddingVertical: 10, paddingHorizontal: 14 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.locName}>{headerLocName}</Text>
              <Text style={styles.locSub}>
                {t("map.locSub", { n: SIGHTINGS.length })}
              </Text>
            </View>
            <IconBtn bg={PB.yellow} onPress={recenter}>
              ⌖
            </IconBtn>
          </View>
        </Sticker>
      </View>

      <View style={styles.bottombar}>
        {selectedPin ? (
          <Sticker bg={PB.cream} style={{ padding: 12 }}>
            <View style={styles.cardRow}>
              <View style={styles.cardArt}>
                <Text style={{ fontSize: 26 }}>{selectedPin.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{selectedPin.name}</Text>
                <Text style={styles.cardWhere}>
                  {selectedPin.lat.toFixed(4)}°, {selectedPin.lng.toFixed(4)}°
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable
                  onPress={() => {
                    removeMapPin(selectedPin.at);
                    setSelectedPin(null);
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
        ) : (
          <Sticker
            bg={PB.cream}
            style={{ padding: 12 }}
            onPress={() => go("scan")}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardArt}>
                <Text style={{ fontSize: 26 }}>{s.bug}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <Text style={styles.cardTitle}>
                    {t("map.sightings", { n: s.size + 1 })}
                  </Text>
                  <Text style={styles.cardDistance}>{t("map.distance")}</Text>
                </View>
                <Text style={styles.cardWhere}>{t("map.where")}</Text>
              </View>
              <View style={styles.huntPill}>
                <Text style={styles.huntPillText}>{t("map.hunt")}</Text>
              </View>
            </View>
          </Sticker>
        )}
      </View>

      <TabBar active="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.blue },
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
  cardDistance: { fontSize: 11, color: PB.ink, opacity: 0.6 },
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
