import * as Location from 'expo-location';

import { useAppStore } from '@/store/useAppStore';

const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Refresh the cached Map location. Idempotent and safe to call on every
 * Map mount — it short-circuits when the cache is under 15 minutes old.
 *
 * This is the *local* location the map centres on; it is independent of
 * `profile.locationShareOn`, which only controls whether coordinates are
 * published. If the OS has never been asked, the Map is the natural place
 * to ask. Denied/failed lookups are swallowed: the Map renders a fallback.
 */
export async function refreshMapLocation(now: number = Date.now()): Promise<void> {
  const { mapLocation, setMapLocation } = useAppStore.getState();
  if (mapLocation && now - mapLocation.at < CACHE_TTL_MS) return;

  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain && perm.status === Location.PermissionStatus.UNDETERMINED) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) return;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    // Coordinates are enough to centre the map; the place name is a bonus
    // (reverse geocoding is flaky offline and on simulators).
    const place = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    })
      .then((places) => places[0])
      .catch(() => undefined);

    setMapLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      city: place?.city ?? place?.subregion ?? place?.district ?? '',
      region: place?.region ?? place?.country ?? '',
      at: now,
    });
  } catch {
    // Best-effort — the Map falls back to its static label on failure.
  }
}
