import { describe, expect, it } from "vitest";

import type { CatchEvent } from "@/lib/streak";
import { altitudeToZoom, buildGlobeMarkers, buildUserPins, minZoomForBounds } from "@/screens/mapGeo";

describe("buildGlobeMarkers", () => {
  it("starts empty: no invented sightings, only the user's own pins", () => {
    const { markers, meta } = buildGlobeMarkers([], null);
    expect(markers).toEqual([]);
    expect(meta.size).toBe(0);
  });

  it("adds a pin per catch and a 'you' marker when the location is known", () => {
    const pins = buildUserPins(
      [{ id: "lady", at: 1, lat: 50, lng: 15 }],
      { lat: 50, lng: 15 },
      () => "Ladybird",
    );
    const { markers, meta } = buildGlobeMarkers(pins, { lat: 51, lng: 16 });
    expect(markers.map((m) => m.id)).toEqual([pins[0]!.id, "you"]);
    expect(meta.get(pins[0]!.id)).toEqual({ kind: "user", pin: pins[0] });
  });
});

describe("buildUserPins", () => {
  it("carries the catch's species id for navigation", () => {
    const catches: CatchEvent[] = [{ id: "lady", at: 1, lat: 50, lng: 15 }];
    const pins = buildUserPins(catches, { lat: 50, lng: 15 }, () => "Ladybird");

    expect(pins).toHaveLength(1);
    expect(pins[0]!.bugId).toBe("lady");
  });
});

describe("altitudeToZoom", () => {
  it("maps the globe's framing altitudes to sensible zoom levels", () => {
    expect(altitudeToZoom(6_000_000, 50)).toBeCloseTo(2.6, 0); // continent
    expect(altitudeToZoom(2_000_000, 50)).toBeCloseTo(4.3, 0); // region
    expect(altitudeToZoom(400_000, 50)).toBeCloseTo(6.6, 0); // recenter on user
  });

  it("zooms in as altitude drops and clamps to 1–20", () => {
    expect(altitudeToZoom(1_000, 50)).toBeGreaterThan(altitudeToZoom(10_000, 50));
    expect(altitudeToZoom(1e12, 0)).toBe(1);
    expect(altitudeToZoom(0.001, 0)).toBe(20);
  });
});

describe('minZoomForBounds', () => {
  const europe = { minLng: -25, minLat: 34, maxLng: 45, maxLat: 72 };

  it('is the zoom at which the pack fills the viewport', () => {
    const z = minZoomForBounds(europe, 402, 874);
    // A 402 x 874 pt screen is taller than wide, so the 38° of latitude decides it.
    expect(z).toBeGreaterThan(2.5);
    expect(z).toBeLessThan(4);
    // One step wider than that zoom would show the empty margin; at z the world strip is >= the screen.
    const worldPx = 512 * 2 ** z;
    expect(worldPx * ((europe.maxLng - europe.minLng) / 360)).toBeGreaterThanOrEqual(402);
  });

  it('needs less zoom on a smaller viewport', () => {
    expect(minZoomForBounds(europe, 200, 300)).toBeLessThan(minZoomForBounds(europe, 402, 874));
  });
});
