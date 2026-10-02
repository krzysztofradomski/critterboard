import { findBug } from "@/data/bugs";
import type { CatchEvent } from "@/lib/streak";
import { PB } from "@/tokens/pb";

/** A pin on the map. `icon` is an emoji; `color` is the pin background. */
export type Marker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  icon?: string;
  color?: string;
  shape?: "icon" | "orb";
};

/** Fallback map focus when the user has no location and no catches yet. */
const EUROPE_CENTER = { lat: 50, lng: 15 };
// Continental framing for the Europe fallback (shows the continent + coastlines
// + surrounding seas, not a green inland patch).
const EUROPE_VIEW_ALT_M = 6_000_000;
// Framing once we know the user's actual spot: roughly a city (zoom ~11.7),
// since an offline pack has street-level detail, not continent-scale context.
export const LOCAL_VIEW_ALT_M = 12_000;

export type UserPinData = {
  id: string;
  /** Species id from `BUGS`, for click-through to the insect detail. */
  bugId: string;
  at: number;
  emoji: string;
  name: string;
  lat: number;
  lng: number;
};

export type MapMarkerMeta = { kind: "user"; pin: UserPinData };

export type MapInitialView = {
  lng: number;
  lat: number;
  altM: number;
};

function haversineMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Altitude that frames a marker group in view . */
function frameAltitudeM(
  markers: Array<{ lng: number; lat: number }>,
  centerLng: number,
  centerLat: number,
): number {
  let maxFromCenter = 0;
  for (const m of markers) {
    maxFromCenter = Math.max(
      maxFromCenter,
      haversineMeters(centerLng, centerLat, m.lng, m.lat),
    );
  }
  const spanM = Math.max(2, maxFromCenter * 2);
  return Math.min(8_000_000, Math.max(6, spanM / 0.56));
}

/** Regional view framing the user's location/catches; falls back to Europe. */
export function resolveInitialMapView(
  markers: Marker[],
  mapLocation: { lat: number; lng: number } | null = null,
  center: { lat: number; lng: number } = EUROPE_CENTER,
): MapInitialView {
  const userPins = markers.filter((m) => m.id.startsWith("user-"));
  const you = markers.find((m) => m.id === "you");

  if (userPins.length > 0) {
    const lng = userPins.reduce((sum, m) => sum + m.lng, 0) / userPins.length;
    const lat = userPins.reduce((sum, m) => sum + m.lat, 0) / userPins.length;
    return { lng, lat, altM: frameAltitudeM(userPins, lng, lat) };
  }

  if (you) {
    return { lng: you.lng, lat: you.lat, altM: LOCAL_VIEW_ALT_M };
  }

  if (mapLocation) {
    return { lng: mapLocation.lng, lat: mapLocation.lat, altM: LOCAL_VIEW_ALT_M };
  }

  // No computed location yet — start on the predefined centre of Europe rather
  // than the default globe view (which lands on the Americas).
  return { lng: center.lng, lat: center.lat, altM: EUROPE_VIEW_ALT_M };
}

/**
 * Convert the globe's camera altitude to a Web Mercator zoom level so the
 * same framing logic drives the flat offline map. Treats the altitude as the
 * visible ground span across a ~390 pt wide phone screen.
 */
export function altitudeToZoom(altM: number, lat: number): number {
  const METERS_PER_PX_Z0 = 156_543.03392; // equator, 256 px tiles
  const SCREEN_WIDTH_PT = 390;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const zoom = Math.log2((METERS_PER_PX_Z0 * cosLat * SCREEN_WIDTH_PT) / Math.max(1, altM));
  return Math.min(20, Math.max(1, zoom));
}

/**
 * Lowest zoom at which a viewport of `widthPt` x `heightPt` is still entirely inside `bounds`
 * (MapLibre's world is 512 px wide at zoom 0). Zooming out further would show the empty margin.
 */
export function minZoomForBounds(
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  widthPt: number,
  heightPt: number,
): number {
  const mercY = (lat: number) => {
    const clamped = Math.max(-85, Math.min(85, lat));
    return 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) / (2 * Math.PI);
  };
  const lngFrac = Math.max(1e-6, (bounds.maxLng - bounds.minLng) / 360);
  const latFrac = Math.max(1e-6, Math.abs(mercY(bounds.minLat) - mercY(bounds.maxLat)));
  const z = Math.max(Math.log2(widthPt / (512 * lngFrac)), Math.log2(heightPt / (512 * latFrac)));
  return Math.ceil(z * 10) / 10;
}

export function resolveMapCenter(
  mapLocation: { lat: number; lng: number } | null,
  userCatches: CatchEvent[],
): { lat: number; lng: number } {
  if (mapLocation) return { lat: mapLocation.lat, lng: mapLocation.lng };
  const newest = userCatches[0];
  if (newest?.lat != null && newest.lng != null) {
    return { lat: newest.lat, lng: newest.lng };
  }
  return { ...EUROPE_CENTER };
}

export function buildUserPins(
  userCatches: CatchEvent[],
  center: { lat: number; lng: number },
  bugNameFor: (id: string) => string,
): UserPinData[] {
  return userCatches
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => {
      const bug = findBug(c.id);
      return {
        id: `user-${c.id}-${c.at}`,
        bugId: c.id,
        at: c.at,
        emoji: bug?.emoji ?? "🐛",
        name: bugNameFor(c.id),
        lat: c.lat!,
        lng: c.lng!,
      };
    });
}

export function buildGlobeMarkers(
  userPins: UserPinData[],
  mapLocation: { lat: number; lng: number } | null,
): { markers: Marker[]; meta: Map<string, MapMarkerMeta> } {
  const markers: Marker[] = [];
  const meta = new Map<string, MapMarkerMeta>();

  for (const pin of userPins) {
    markers.push({
      id: pin.id,
      label: pin.name,
      lat: pin.lat,
      lng: pin.lng,
      icon: pin.emoji,
      shape: "icon",
      color: PB.purple,
    });
    meta.set(pin.id, { kind: "user", pin });
  }

  if (mapLocation) {
    markers.push({
      id: "you",
      label: "You",
      lat: mapLocation.lat,
      lng: mapLocation.lng,
      shape: "orb",
      color: PB.red,
    });
  }

  return { markers, meta };
}
