import type {
  LayerSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-react-native";

import { PB } from "@/tokens/pb";

/**
 * Critterboard's "sticker" MapLibre style for Protomaps basemap tiles
 * (https://docs.protomaps.com/basemaps/layers). Flat PB colours, ink
 * outlines and a hard offset shadow under the land, like the rest of the
 * UI. No labels, so no glyphs or sprites to fetch: the style is 100%
 * offline and the only external input is the local PMTiles file.
 */

export const MAP_COLORS = {
  sea: "#9cc7ff",
  land: PB.cream,
  shadow: PB.ink,
  forest: "#7cc47f",
  grass: "#b9e08a",
  farmland: PB.cream2,
  urban: "#f6e2bd",
  water: "#9cc7ff",
  highway: PB.orange,
  major: PB.yellow,
  minor: PB.paper,
  path: PB.ink,
  ink: PB.ink,
} as const;

export const MAP_SOURCE_ID = "protomaps";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

const SRC = { source: MAP_SOURCE_ID } as const;
const isPolygon = ["==", ["geometry-type"], "Polygon"] as const;

/** Width that grows with zoom — `[z, px]` stops, linear interpolation. */
const byZoom = (...stops: Array<[number, number]>) =>
  ["interpolate", ["linear"], ["zoom"], ...stops.flat()] as unknown as number;

const kindIn = (...kinds: string[]) =>
  ["in", ["get", "kind"], ["literal", kinds]] as const;

/** A road class drawn as an ink casing + a coloured fill line on top. */
function road(
  id: string,
  kinds: string[],
  color: string,
  minzoom: number,
  width: Array<[number, number]>,
): LayerSpecification[] {
  const filter = ["all", kindIn(...kinds), ["!", ["has", "is_tunnel"]]];
  return [
    {
      id: `${id}_casing`,
      type: "line",
      ...SRC,
      "source-layer": "roads",
      minzoom,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": MAP_COLORS.ink,
        "line-width": byZoom(...width.map(([z, w]): [number, number] => [z, w + 2.5])),
      },
    },
    {
      id,
      type: "line",
      ...SRC,
      "source-layer": "roads",
      minzoom,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": color, "line-width": byZoom(...width) },
    },
  ] as LayerSpecification[];
}

/** Layers that read the vector tiles (everything except the background). */
function tileLayers(): LayerSpecification[] {
  return [
    // Hard offset "sticker" shadow under all land.
    {
      id: "earth_shadow",
      type: "fill",
      ...SRC,
      "source-layer": "earth",
      filter: isPolygon,
      paint: {
        "fill-color": MAP_COLORS.shadow,
        "fill-translate": [3, 3],
        "fill-antialias": false,
      },
    },
    {
      id: "earth",
      type: "fill",
      ...SRC,
      "source-layer": "earth",
      filter: isPolygon,
      paint: { "fill-color": MAP_COLORS.land },
    },
    {
      id: "landcover",
      type: "fill",
      ...SRC,
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          "forest", MAP_COLORS.forest,
          ["grassland", "scrub"], MAP_COLORS.grass,
          "farmland", MAP_COLORS.farmland,
          "urban_area", MAP_COLORS.urban,
          MAP_COLORS.land,
        ],
        "fill-opacity": byZoom([0, 1], [10, 0.6]),
      },
    },
    {
      id: "landuse_green",
      type: "fill",
      ...SRC,
      "source-layer": "landuse",
      filter: kindIn(
        "park", "national_park", "nature_reserve", "protected_area",
        "forest", "wood", "grass", "grassland", "meadow", "garden",
        "cemetery", "golf_course", "village_green", "allotments",
      ),
      paint: {
        "fill-color": [
          "match",
          ["get", "kind"],
          ["forest", "wood", "nature_reserve", "national_park"], MAP_COLORS.forest,
          MAP_COLORS.grass,
        ],
      },
    },
    {
      id: "landuse_green_outline",
      type: "line",
      ...SRC,
      "source-layer": "landuse",
      minzoom: 12,
      filter: kindIn("park", "forest", "wood", "nature_reserve", "garden"),
      paint: { "line-color": MAP_COLORS.ink, "line-width": byZoom([12, 0.5], [16, 1.5]) },
    },
    {
      id: "water",
      type: "fill",
      ...SRC,
      "source-layer": "water",
      filter: isPolygon,
      paint: { "fill-color": MAP_COLORS.water },
    },
    {
      id: "water_lines",
      type: "line",
      ...SRC,
      "source-layer": "water",
      filter: kindIn("river", "stream", "canal"),
      layout: { "line-cap": "round" },
      paint: {
        "line-color": MAP_COLORS.water,
        "line-width": byZoom([8, 1], [14, 4], [18, 10]),
      },
    },
    // Ink coastline / shore outlines.
    {
      id: "earth_outline",
      type: "line",
      ...SRC,
      "source-layer": "earth",
      paint: { "line-color": MAP_COLORS.ink, "line-width": byZoom([0, 0.8], [8, 1.8], [14, 3]) },
    },
    {
      id: "water_outline",
      type: "line",
      ...SRC,
      "source-layer": "water",
      minzoom: 10,
      filter: isPolygon,
      paint: { "line-color": MAP_COLORS.ink, "line-width": byZoom([10, 0.8], [16, 2]) },
    },
    {
      id: "roads_path",
      type: "line",
      ...SRC,
      "source-layer": "roads",
      minzoom: 14,
      filter: kindIn("path"),
      paint: {
        "line-color": MAP_COLORS.path,
        "line-width": byZoom([14, 0.8], [18, 2]),
        "line-dasharray": [2, 2],
      },
    },
    ...road("roads_minor", ["minor_road"], MAP_COLORS.minor, 12, [[12, 0.5], [15, 3], [18, 10]]),
    ...road("roads_major", ["major_road"], MAP_COLORS.major, 8, [[8, 0.8], [12, 2.5], [16, 7], [18, 14]]),
    ...road("roads_highway", ["highway"], MAP_COLORS.highway, 5, [[5, 0.8], [10, 2.5], [14, 6], [18, 16]]),
    {
      id: "buildings",
      type: "fill",
      ...SRC,
      "source-layer": "buildings",
      minzoom: 15,
      paint: {
        "fill-color": MAP_COLORS.farmland,
        "fill-outline-color": MAP_COLORS.ink,
      },
    },
    {
      id: "boundaries_country",
      type: "line",
      ...SRC,
      "source-layer": "boundaries",
      filter: ["<=", ["get", "kind_detail"], 2],
      paint: {
        "line-color": MAP_COLORS.ink,
        "line-width": byZoom([2, 0.8], [10, 2]),
        "line-dasharray": [3, 2],
      },
    },
  ] as LayerSpecification[];
}

/** Turn a local file URI into the URL MapLibre Native's PMTiles source reads. */
export function toPmtilesUrl(fileUri: string): string {
  return `pmtiles://${fileUri}`;
}

/**
 * Build the style. With no tiles (no map pack installed yet) it is just the
 * sea background, so the screen still renders and pins still show.
 */
export function buildStickerStyle(tilesUrl: string | null): StyleSpecification {
  return {
    version: 8,
    name: "critterboard-sticker",
    sources: tilesUrl
      ? {
          [MAP_SOURCE_ID]: {
            type: "vector",
            url: tilesUrl,
            attribution: OSM_ATTRIBUTION,
          },
        }
      : {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": MAP_COLORS.sea },
      },
      ...(tilesUrl ? tileLayers() : []),
    ],
  };
}
