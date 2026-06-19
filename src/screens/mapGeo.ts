import type { Marker } from "react-cartoon-planet";

import { findBug } from "@/data/bugs";
import { SIGHTINGS } from "@/data/sightings";
import type { CatchEvent } from "@/lib/streak";
import { PB } from "@/tokens/pb";

const USER_PIN_SCALE_PCT_PER_KM = 5;
const PIN_X_CENTER = 46;
const PIN_Y_CENTER = 52;

// react-cartoon-planet sizes markers relative to a ~0.024 reference radius
// (globe radius is 1). Values near 1 render as Earth-sized cream blobs, so keep
// every marker in the library's intended 0.02–0.03 band.
const SIGHTING_MARKER_SIZE = 0.024;
const USER_PIN_MARKER_SIZE = 0.026;
const YOU_MARKER_SIZE = 0.02;

/** Fallback map focus when the user has no location and no catches yet. */
const EUROPE_CENTER = { lat: 50, lng: 15 };
// Continental framing for the Europe fallback (shows the continent + coastlines
// + surrounding seas, not a green inland patch).
const EUROPE_VIEW_ALT_M = 6_000_000;
// Regional framing once we know the user's actual spot — close enough to read
// the area, far enough to keep geographic context.
const REGIONAL_ALT_M = 2_000_000;

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

export type MapMarkerMeta =
  | { kind: "sighting"; index: number; bugId: string }
  | { kind: "user"; pin: UserPinData };

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

/** Altitude that frames a marker group in view (mirrors react-cartoon-planet clustering). */
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
    return { lng: you.lng, lat: you.lat, altM: REGIONAL_ALT_M };
  }

  if (mapLocation) {
    return { lng: mapLocation.lng, lat: mapLocation.lat, altM: REGIONAL_ALT_M };
  }

  // No computed location yet — start on the predefined centre of Europe rather
  // than the default globe view (which lands on the Americas).
  return { lng: center.lng, lat: center.lat, altM: EUROPE_VIEW_ALT_M };
}

export function critterboardEarthMap(
  base: import("react-cartoon-planet").PlanetMapDefinition,
  url: string,
): import("react-cartoon-planet").PlanetMapDefinition {
  return {
    ...base,
    url,
    atmosphereStrength: 0,
  };
}

export function project(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
): { x: number; y: number } {
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos((centerLat * Math.PI) / 180);
  const dxKm = (lng - centerLng) * kmPerDegLng;
  const dyKm = (lat - centerLat) * kmPerDegLat;
  const x = PIN_X_CENTER + dxKm * USER_PIN_SCALE_PCT_PER_KM;
  const y = PIN_Y_CENTER - dyKm * USER_PIN_SCALE_PCT_PER_KM;
  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(4, Math.min(96, y)),
  };
}

export function unproject(
  xPct: number,
  yPct: number,
  centerLat: number,
  centerLng: number,
): { lat: number; lng: number } {
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos((centerLat * Math.PI) / 180);
  const dxKm = (xPct - PIN_X_CENTER) / USER_PIN_SCALE_PCT_PER_KM;
  const dyKm = (PIN_Y_CENTER - yPct) / USER_PIN_SCALE_PCT_PER_KM;
  return {
    lat: centerLat + dyKm / kmPerDegLat,
    lng: centerLng + dxKm / kmPerDegLng,
  };
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
  center: { lat: number; lng: number },
  userPins: UserPinData[],
  mapLocation: { lat: number; lng: number } | null,
): { markers: Marker[]; meta: Map<string, MapMarkerMeta> } {
  const markers: Marker[] = [];
  const meta = new Map<string, MapMarkerMeta>();

  SIGHTINGS.forEach((sp, index) => {
    const bug = findBug(sp.bugId);
    const { lat, lng } = unproject(sp.x, sp.y, center.lat, center.lng);
    const id = `sighting-${index}`;
    markers.push({
      id,
      label: bug?.name ?? sp.bugId,
      lat,
      lng,
      icon: bug?.emoji ?? "🐛",
      shape: "icon",
      // Colour the pin by its species so sightings read as distinct on the globe.
      color: bug?.color ?? PB.cream,
      size: SIGHTING_MARKER_SIZE,
    });
    meta.set(id, { kind: "sighting", index, bugId: sp.bugId });
  });

  for (const pin of userPins) {
    markers.push({
      id: pin.id,
      label: pin.name,
      lat: pin.lat,
      lng: pin.lng,
      icon: pin.emoji,
      shape: "icon",
      color: PB.purple,
      size: USER_PIN_MARKER_SIZE,
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
      size: YOU_MARKER_SIZE,
    });
  }

  return { markers, meta };
}
