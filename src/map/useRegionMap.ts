import { useCallback, useEffect, useState } from "react";

import { getPackData } from "@/data/regionPacks";
import { downloadMapPack, installedMapPack, resolveMapUrl } from "@/map/mapPack";

export type RegionMapState =
  | { kind: "no-region" }
  | { kind: "checking" }
  /** The region has no map to download (yet). */
  | { kind: "unavailable" }
  | { kind: "needs-download" }
  | { kind: "downloading"; pct: number }
  | { kind: "error" }
  | { kind: "ready"; fileUri: string };

/**
 * The offline map of the active region: on the device, downloadable, or not
 * available. The map is only shown in `ready`; every other state is a reason
 * (and sometimes an action) for the placeholder.
 */
export function useRegionMap(regionId: string | null): {
  state: RegionMapState;
  download: () => void;
} {
  const [state, setState] = useState<RegionMapState>({ kind: "checking" });
  // Bumped by download() so a retry re-runs the check.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!regionId) {
      setState({ kind: "no-region" });
      return;
    }
    let cancelled = false;
    setState({ kind: "checking" });
    void installedMapPack(regionId).then((fileUri) => {
      if (cancelled) return;
      if (fileUri) return setState({ kind: "ready", fileUri });
      setState(resolveMapUrl(getPackData(regionId)) ? { kind: "needs-download" } : { kind: "unavailable" });
    });
    return () => {
      cancelled = true;
    };
  }, [regionId, attempt]);

  const download = useCallback(() => {
    if (!regionId) return;
    const url = resolveMapUrl(getPackData(regionId));
    if (!url) return;
    setState({ kind: "downloading", pct: 0 });
    downloadMapPack(regionId, url, (pct) => setState({ kind: "downloading", pct }))
      .then(() => setAttempt((n) => n + 1))
      .catch(() => setState({ kind: "error" }));
  }, [regionId]);

  return { state, download };
}
