import * as Location from 'expo-location';

import { useAppStore } from '@/store/useAppStore';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh the cached Map header location. Idempotent and safe to call
 * on every Map mount — it short-circuits when:
 *
 *   - `profile.locationShareOn` is off (also clears any stale cache so
 *     toggling share off makes the header go private immediately)
 *   - the cache is fresh (<24h since `at`)
 *   - the OS hasn't granted foreground location permission
 *
 * Failures are swallowed: the Map renders a fallback label rather than
 * surfacing a transient permission/network blip.
 */
export async function refreshMapLocation(now: number = Date.now()): Promise<void> {
  const { profile, mapLocation, setMapLocation } = useAppStore.getState();

  if (!profile.locationShareOn) {
    if (mapLocation) setMapLocation(null);
    return;
  }
  if (mapLocation && now - mapLocation.at < CACHE_TTL_MS) return;

  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const place = places[0];
    if (!place) return;

    setMapLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      city: place.city ?? place.subregion ?? place.district ?? '',
      region: place.region ?? place.country ?? '',
      at: now,
    });
  } catch {
    // Best-effort — header falls back to its static label on failure.
  }
}
