import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Btn } from "@/components/Btn";
import { Sticker } from "@/components/Sticker";
import { useT } from "@/i18n/helpers";
import { MAP_COLORS } from "@/map/stickerStyle";
import type { RegionMapState } from "@/map/useRegionMap";
import { PB } from "@/tokens/pb";

/**
 * Stands in for the map until the active region's map is on the device:
 * explains why it's off and offers the one action that fixes it.
 */
export function MapLocked({
  state,
  regionName,
  mapMb,
  onDownload,
  onOpenBrains,
}: {
  state: RegionMapState;
  regionName: string;
  mapMb: number;
  onDownload: () => void;
  onOpenBrains: () => void;
}) {
  const t = useT();
  if (state.kind === "checking") return <View style={styles.root} />;

  const body =
    state.kind === "no-region" ? t("map.noRegionSub")
    : state.kind === "unavailable" ? t("map.unavailableSub", { name: regionName })
    : state.kind === "downloading" ? t("map.downloadingSub", { pct: state.pct })
    : state.kind === "error" ? t("map.errorSub")
    : t("map.needsDownloadSub", { name: regionName, mb: mapMb });

  const action =
    state.kind === "no-region" ? { label: t("map.noRegionCta"), onPress: onOpenBrains }
    : state.kind === "needs-download" ? { label: t("map.downloadCta", { mb: mapMb }), onPress: onDownload }
    : state.kind === "error" ? { label: t("map.retryCta"), onPress: onDownload }
    : null;

  return (
    <View style={styles.root}>
      <Sticker bg={PB.cream} style={styles.card}>
        <Text style={{ fontSize: 40 }}>🗺️</Text>
        <Text style={styles.title}>{t("map.lockedTitle")}</Text>
        <Text style={styles.body}>{body}</Text>
        {state.kind === "downloading" && (
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${state.pct}%` }]} />
          </View>
        )}
        {action && (
          <Btn full bg={PB.ink} color={PB.yellow} onPress={action.onPress}>
            {action.label}
          </Btn>
        )}
      </Sticker>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: MAP_COLORS.noData,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: { padding: 18, gap: 10, alignItems: "center", alignSelf: "stretch" },
  title: { fontSize: 20, fontWeight: "800", color: PB.ink },
  body: { fontSize: 13, color: PB.ink, opacity: 0.75, textAlign: "center", fontWeight: "600" },
  bar: {
    alignSelf: "stretch",
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: PB.ink,
    backgroundColor: PB.cream2,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: PB.green },
});
