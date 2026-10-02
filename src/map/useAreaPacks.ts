import { useCallback, useEffect, useState } from "react";

import { fetchAreaCatalog, pickArea, type AreaPack } from "@/map/areas";
import { areaPackId, downloadMapPack, installedAreaPacks, type InstalledAreaPack } from "@/map/mapPack";

export type AreaOfferState =
  | { kind: "none" }
  | { kind: "offer"; area: AreaPack }
  | { kind: "downloading"; area: AreaPack; pct: number }
  | { kind: "error"; area: AreaPack };

/**
 * Street-detail packs for the Map: which are on the device, and whether to
 * offer one for where the user is. Offers need the catalog (a small online
 * fetch, skipped when offline); installed packs work with no network at all.
 */
export function useAreaPacks(
  location: { lat: number; lng: number } | null,
  enabled: boolean,
): { installed: InstalledAreaPack[]; offer: AreaOfferState; download: () => void } {
  const [installed, setInstalled] = useState<InstalledAreaPack[]>([]);
  const [catalog, setCatalog] = useState<AreaPack[]>([]);
  const [progress, setProgress] = useState<{ pct: number } | "error" | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void installedAreaPacks().then((p) => !cancelled && setInstalled(p));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !location) return;
    let cancelled = false;
    void fetchAreaCatalog().then((c) => !cancelled && setCatalog(c));
    return () => {
      cancelled = true;
    };
    // Re-fetching per fix isn't needed: the catalog is tiny and rarely changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, location !== null]);

  const area = location ? pickArea(catalog, location.lat, location.lng) : null;
  const isInstalled = !!area && installed.some((p) => p.id === area.id);

  const download = useCallback(() => {
    if (!area?.url) return;
    setProgress({ pct: 0 });
    downloadMapPack(areaPackId(area.id), area.url, (pct) => setProgress({ pct }))
      .then(() => installedAreaPacks())
      .then((p) => {
        setInstalled(p);
        setProgress(null);
      })
      .catch(() => setProgress("error"));
  }, [area]);

  let offer: AreaOfferState = { kind: "none" };
  if (area && !isInstalled) {
    offer =
      progress === "error" ? { kind: "error", area }
      : progress ? { kind: "downloading", area, pct: progress.pct }
      : { kind: "offer", area };
  }
  return { installed, offer, download };
}
