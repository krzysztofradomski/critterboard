import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";

import {
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
    expect(style.layers.map((l) => l.id)).toEqual(["background"]);
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

  it("needs no network assets: no glyphs, sprites or symbol layers", () => {
    const style = buildStickerStyle(TILES);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(style.layers.some((l) => l.type === "symbol")).toBe(false);
  });

  it("has unique layer ids", () => {
    const ids = buildStickerStyle(TILES).layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
