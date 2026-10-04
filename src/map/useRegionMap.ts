import { useCallback, useEffect, useState } from "react";

import { getPackData } from "@/data/regionPacks";
import { useAppStore } from "@/store/useAppStore";
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
  // A pack refresh at boot (new version, new mapUrl) must re-run the check.
  const packVersion = useAppStore((st) => (regionId ? st.installedPackVersions[regionId] : undefined));
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
  }, [regionId, attempt, packVersion]);

  const download = useCallback(() => {
    if (!regionId) return;
    const pack = getPackData(regionId);
    if (!resolveMapUrl(pack)) return;
    setState({ kind: "downloading", pct: 0 });
    downloadMapPack(regionId, pack, (pct) => setState({ kind: "downloading", pct }))
      .then(() => setAttempt((n) => n + 1))
      .catch(() => setState({ kind: "error" }));
  }, [regionId]);

  return { state, download };
}
