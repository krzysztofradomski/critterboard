import type { Marker } from "react-cartoon-planet";

import { findBug } from "@/data/bugs";
import { SIGHTINGS } from "@/data/sightings";
import type { CatchEvent } from "@/lib/streak";
import { PB } from "@/tokens/pb";

const USER_PIN_SCALE_PCT_PER_KM = 5;
const PIN_X_CENTER = 46;
const PIN_Y_CENTER = 52;

export type UserPinData = {
  id: string;
  at: number;
  emoji: string;
  name: string;
  lat: number;
  lng: number;
};

export type MapMarkerMeta =
  | { kind: "sighting"; index: number }
  | { kind: "user"; pin: UserPinData };

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
  return { lat: 20, lng: 0 };
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
    const { lat, lng } = unproject(sp.x, sp.y, center.lat, center.lng);
    const id = `sighting-${index}`;
    markers.push({
      id,
      label: sp.bug,
      lat,
      lng,
      icon: sp.bug,
      shape: "icon",
      color: PB.cream,
      size: 0.75 + sp.size * 0.15,
    });
    meta.set(id, { kind: "sighting", index });
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
      size: 0.9,
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
      size: 0.55,
    });
  }

  return { markers, meta };
}
