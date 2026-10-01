# Offline map (MapLibre + PMTiles)

`#architecture` `#map` `#offline`

The Map tab is a flat 2D map that works with **no network** after a one-time download. MapLibre Native draws a local PMTiles vector-tile file with Critterboard's own "sticker" style. It replaced the old `react-cartoon-planet` 3D globe, which has been removed.

> See also: [[../decisions/003-offline-map-maplibre-pmtiles]] (why), [[../architecture]], [[backend-adapter]] (packs will be hosted on Cloudflare R2), `tools/map/README.md` (making packs).

## How it fits together

```mermaid
flowchart LR
  subgraph Build["Build time (your Mac / CI)"]
    P[Protomaps daily planet build] -->|pmtiles extract --bbox --maxzoom| F[region.pmtiles]
  end
  F -->|host: dev http server → later R2| URL[(pack URL)]
  subgraph App["On the phone"]
    URL -->|download once| D[documents/maps/id.pmtiles]
    D -->|pmtiles://file://…| ML[MapLibre Native]
    S[stickerStyle.ts<br/>bundled, no glyphs/sprites] --> ML
    MK[mapGeo markers] --> ML
  end
```

## Pieces

| File | Role |
|---|---|
| `src/map/stickerStyle.ts` | Builds the MapLibre style from `pb.ts` colours: land with a hard ink offset shadow, ink coastlines, flat greens, chunky ink-cased roads. Pixel landmark icons (tree, flower, peak) at z13+ come from `assets/map/` via `<Images>` (regenerate with `tools/map/gen_pixel_icons.py`). No text labels, so no glyph or sprite downloads. With no pack it returns just the sea background. |
| `src/map/mapPack.ts` | Download-once helper. Writes `<id>.pmtiles.part`, renames on success, so a half download never counts as installed. |
| `src/components/OfflineMap.tsx` | The map component, with a `flyTo` handle. Renders markers as React views (round stickers with a `PixelBug` sprite). Registers the water wave texture with `<Images>`. |
| `src/screens/mapGeo.ts` | `altitudeToZoom()` converts the globe's camera altitudes to Mercator zoom, so the existing framing logic carries over. |
| `src/screens/Map.tsx` | `USE_OFFLINE_MAP` flag picks `OfflineMap` or the globe (native only; web still uses the globe). |
| `tools/map/extract.sh` | Cuts a region out of the Protomaps planet build; `--sizes` estimates pack size per zoom. |

## Tile schema

Protomaps basemap v4 layers: `earth`, `water`, `landcover`, `landuse`, `roads`, `buildings`, `boundaries` (plus `places` / `pois`, unused because there are no labels). Features are classified by `kind` (`park`, `forest`, `highway`, `major_road`, `minor_road`, `path`, `river`, …). Reference: <https://docs.protomaps.com/basemaps/layers>.

## Coverage and zoom

A pack only covers its extract bbox (plus the low-zoom parent tiles above it). Outside that, tiles don't exist, so the style must not pretend it is sea:

- The background is a muted "no data" paper with a pixel-dot pattern (`assets/map/nodata.png`).
- The sea is drawn from a GeoJSON box of the pack's coverage (`coverage_sea` / `coverage_waves`), read from the PMTiles v3 header (`parsePmtilesBounds`, bytes 102..117) when the pack is loaded. Real water polygons from the tiles draw on top.
- `+` / `−` buttons on the Map call `OfflineMapHandle.zoomBy`, which rounds to whole zoom levels and clamps to 1..18 (tiles stop at 14; beyond that is over-zoom).
- When the location is known the map frames about 12 km (`LOCAL_VIEW_ALT_M`, zoom ~11.7) instead of a continent. A tight pack can't show wide-area context.

MapLibre Native briefly requests its built-in demo style at startup and cancels it as soon as our style is applied; that is inside the native library and can't be turned off from JS.

## Location and pins

The map centres on the device location whenever the OS permission is granted (the Map asks once if it never was). The user's own catches become pins when they have coordinates. Public sharing (`profile.locationShareOn`) is separate: it only decides whether coordinates are published to the backend. There are no demo sightings; an empty map shows a hint card.

## Sizing

Each extra zoom level is about 4× more data. Plan: the whole region at low zoom (≈10) inside the region pack, plus the user's local area at street zoom (14–15) as a separate "save my area" download. Measure real numbers with `tools/map/extract.sh --sizes <bbox>`.

## Status: spike

- Done: style (validated against the MapLibre style spec in tests), download-once helper, component, Map screen wiring, extract tooling. iOS/Android/web bundles and `expo prebuild` pass.
- To prove on device: MapLibre Native reads `pmtiles://file://…` from the app's documents folder on iOS, the look on a real extract, marker tap behaviour, performance, and pack sizes.
- Next: `mapUrl` in region packs, R2 hosting, remove the globe dependencies, web renderer (`maplibre-gl` + `pmtiles` protocol), OSM credit in `CreditsDialog`.

## Running on the iOS 27 simulator

- Xcode 27 / iOS 27 kill apps that don't use the UIScene life cycle. Expo SDK 57's template doesn't yet, so `plugins/withSceneDelegate.js` wires in Expo's `ExpoAppSceneDelegate` at prebuild. Delete the plugin once the Expo template does this itself.
- `pod install` needs a UTF-8 locale: `LANG=en_US.UTF-8 npx expo run:ios`.
- The device ID comes from `expo-crypto` (Hermes has no global `crypto`).
- To see the map, make a pack with `tools/map/extract.sh` and serve it ([[../../tools/map/README]]). Landmark icons only appear at zoom 13 and up.

## Licensing

Map data is © OpenStreetMap contributors (ODbL). The style sets the source attribution, and MapLibre's attribution button shows it on the map.
