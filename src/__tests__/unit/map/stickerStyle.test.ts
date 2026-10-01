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
    expect(style.layers.map((l) => l.id)).toEqual(["background", "background_waves"]);
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
    expect(style.glyphs).toBeUndefined();
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
