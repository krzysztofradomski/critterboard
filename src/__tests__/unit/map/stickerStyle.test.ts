import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import {
  GLYPHS_PLACEHOLDER,
  MAP_SOURCE_ID,
  OSM_ATTRIBUTION,
  buildStickerStyle,
  toPmtilesUrl,
} from "@/map/stickerStyle";

const TILES = toPmtilesUrl("file:///data/maps/dev.pmtiles");

describe("buildStickerStyle", () => {
  it("is a valid MapLibre style with tiles", () => {
    expect(validateStyleMin(buildStickerStyle(TILES) as never)).toEqual([]);
  });

  it("is a valid background-only style without tiles", () => {
    const style = buildStickerStyle(null);
    expect(validateStyleMin(style as never)).toEqual([]);
    expect(style.sources).toEqual({});
    expect(style.layers.map((l) => l.id)).toEqual(["background", "background_nodata"]);
  });

  it("marks coverage: sea inside the pack bounds, no-data background outside", () => {
    const bounds = { minLng: 19.79, minLat: 49.97, maxLng: 20.22, maxLat: 50.13 };
    const style = buildStickerStyle(TILES, bounds);
    expect(validateStyleMin(style as never)).toEqual([]);
    const ids = style.layers.map((l) => l.id);
    expect(ids.indexOf("coverage_sea")).toBeGreaterThan(ids.indexOf("background_nodata"));
    expect(ids.indexOf("coverage_sea")).toBeLessThan(ids.indexOf("earth"));
    expect(style.layers.find((l) => l.id === "background")).toMatchObject({
      paint: { "background-color": "#e6d9bd" },
    });
  });

  it("layers street-detail area packs over the base map from the detail zoom", () => {
    const info = { minLng: 19.58, minLat: 49.83, maxLng: 20.28, maxLat: 50.28, minZoom: 0, maxZoom: 13 };
    const style = buildStickerStyle(TILES, null, [
      { id: "krakow", tilesUrl: "pmtiles://file:///data/maps/area-krakow.pmtiles", info },
    ]);
    expect(validateStyleMin(style as never)).toEqual([]);
    expect(style.sources["detail_krakow"]).toMatchObject({ type: "vector" });
    const ids = style.layers.map((l) => l.id);
    // Detail layers come after (draw over) the base layers and carry unique ids.
    expect(ids.indexOf("d_krakow_roads_minor")).toBeGreaterThan(ids.indexOf("roads_minor"));
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of style.layers.filter((x) => x.id.startsWith("d_krakow_"))) {
      expect((l as { source: string }).source).toBe("detail_krakow");
      expect((l as { minzoom?: number }).minzoom ?? 0).toBeGreaterThanOrEqual(8);
    }
  });

  it("reads only the local PMTiles source and credits OSM", () => {
    const style = buildStickerStyle(TILES);
    expect(style.sources[MAP_SOURCE_ID]).toMatchObject({
      type: "vector",
      url: "pmtiles://file:///data/maps/dev.pmtiles",
      attribution: OSM_ATTRIBUTION,
    });
    for (const layer of style.layers) {
      if (layer.type !== "background") expect(layer.source).toBe(MAP_SOURCE_ID);
    }
  });

  it("needs no network assets: no glyphs, sprites or text labels", () => {
    const style = buildStickerStyle(TILES);
    // A local placeholder only: native needs *a* glyphs entry for symbol layers, but we draw no text.
    expect(style.glyphs).toBe(GLYPHS_PLACEHOLDER);
    expect(style.glyphs?.startsWith("file:")).toBe(true);
    expect(style.sprite).toBeUndefined();
    // Icons come from bundled <Images>; text would need glyph downloads.
    const text = style.layers.filter(
      (l) => l.type === "symbol" && "text-field" in (l.layout ?? {}),
    );
    expect(text).toEqual([]);
  });

  it("has unique layer ids", () => {
    const ids = buildStickerStyle(TILES).layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
