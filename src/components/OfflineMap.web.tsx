import React from "react";
import { View } from "react-native";

import { PB } from "@/tokens/pb";

export type OfflineMapHandle = {
  flyTo: (lng: number, lat: number, altM?: number) => void;
  zoomBy: (delta: number) => void;
};

/**
 * Web stub: MapLibre Native is phone-only, and the web preview can't download a map pack.
 * ponytail: a blank map area; a web map (maplibre-gl) only if the web preview ever needs one.
 */
export const OfflineMap = React.forwardRef<OfflineMapHandle, Record<string, unknown>>(function OfflineMap(_props, _ref) {
  return <View style={{ flex: 1, backgroundColor: PB.cream2 }} />;
});
