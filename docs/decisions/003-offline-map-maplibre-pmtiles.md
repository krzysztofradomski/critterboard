# ADR 003 — Offline map: MapLibre Native + PMTiles

`#adr` `#map` `#offline`

> See also: [[../modules/offline-map]], [[002-backend-adapter-seam]].

## Context

The Map tab used `react-cartoon-planet`, a 3D globe on `three` + `expo-gl`. It looks playful but has no street-level detail. The first idea was a stylised Leaflet map, but raster tile servers need the network, and Critterboard promises "no internet needed".

## Decision

Use **MapLibre Native** (`@maplibre/maplibre-react-native`) to render **PMTiles** vector tiles from a local file, with a bundled style built from the app's design tokens.

- Map data comes from Protomaps' OpenStreetMap builds, cut per region with `pmtiles extract`.
- The app downloads a region's `.pmtiles` once (alongside species + vision model in the region pack), then renders fully offline.
- The style has no labels, so there are no glyphs or sprites to fetch.

## Alternatives considered

- **Leaflet in a WebView / DOM component** — reading a large local file from inside a WebView is awkward, canvas rendering is slower, and there is no rotation. Rejected.
- **Hosted stylised raster tiles** (Stadia/Stamen, CARTO) — needs the network and an API key. Rejected for offline.
- **Custom SVG map from simplified shapes** — tiny and fully custom, but no streets, and zoom/level-of-detail would be hand-built. Rejected.

## Consequences

- One more native dependency (MapLibre Native via Swift Package Manager / Gradle), set up by its Expo config plugin. Requires a dev build; the app already needs one.
- Retired `react-cartoon-planet`, `three`, `@types/three`, `expo-gl` and the web globe (removed from the repo).
- Pack sizes grow about 4× per zoom level, so regions ship at low zoom and street detail is an opt-in local-area download.
- OSM attribution is required on the map and in credits.
