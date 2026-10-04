# Offline map packs

`#tools` `#map`

Make a PMTiles map pack for the offline map spike. See [[../../docs/modules/offline-map]].

## 1. Cut a region

```bash
brew install pmtiles

# How big would a region be at zoom 10..15? (use a small bbox; Europe at 9+ is huge)
tools/map/extract.sh --sizes 19.79,49.97,20.22,50.13

# Whole of Europe, country-level detail (zoom 7, ~56 MB)
tools/map/extract.sh europe -25,34,45,72 7
```

This reads only the needed byte ranges from the Protomaps daily planet build,
so it downloads the region's tiles, not the planet. Output lands in
`tools/map/out/` (git-ignored). Find a bbox with <https://boundingbox.klokantech.com>
("CSV" format). Set `PROTOMAPS_BUILD=YYYYMMDD` to pin a specific build.

## 2. Serve it to the app (spike only)

```bash
python3 -m http.server 8787 --directory tools/map/out
```

In `.env`:

```bash
# Simulator (shares the Mac's network)
EXPO_PUBLIC_MAP_PACK_URL=http://localhost:8787/europe.pmtiles
# Physical iPhone on the same Wi-Fi: use the Mac's LAN IP instead
# EXPO_PUBLIC_MAP_PACK_URL=http://192.168.1.20:8787/europe.pmtiles
```

Then `pnpm ios:sim`. The first time the Map tab opens, the app downloads the
pack once into its documents folder. After that it never touches the network:
stop the server, turn on airplane mode, and the map should still render.

To force a re-download in the simulator, delete the app (or its data).
Production packs will be served over HTTPS from Cloudflare R2 with the region packs.

