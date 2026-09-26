import { describe, expect, it } from "vitest";

import { findBug } from "@/data/bugs";
import { SIGHTINGS } from "@/data/sightings";
import type { CatchEvent } from "@/lib/streak";
import { altitudeToZoom, buildGlobeMarkers, buildUserPins } from "@/screens/mapGeo";

describe("demo sightings map to real species", () => {
  it("every sighting bugId resolves to a real bug", () => {
    for (const s of SIGHTINGS) {
      expect(findBug(s.bugId), `sighting bugId "${s.bugId}"`).toBeDefined();
    }
  });
});

describe("buildGlobeMarkers", () => {
  const center = { lat: 50, lng: 15 };

  it("colours each sighting marker by its species and records bugId in meta", () => {
    const { markers, meta } = buildGlobeMarkers(center, [], null);

    SIGHTINGS.forEach((s, index) => {
      const bug = findBug(s.bugId)!;
      const id = `sighting-${index}`;
      const marker = markers.find((m) => m.id === id);

      expect(marker, id).toBeDefined();
      expect(marker!.color).toBe(bug.color);
      expect(marker!.icon).toBe(bug.emoji);
      expect(meta.get(id)).toEqual({ kind: "sighting", index, bugId: s.bugId });
    });
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
