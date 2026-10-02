#!/usr/bin/env bash
# Cut a street-detail "area pack": a square of RADIUS_KM around a point, down to
# zoom 13, from the latest Protomaps daily build. These are the small downloads
# the app offers on top of the Europe base map.
#
#   tools/map/extract-area.sh <id> <lat> <lng> [radius_km=25] [maxzoom=13]
#
# Output: tools/map/out/area-<id>.pmtiles, plus an entry printed for packs/areas.json.
set -euo pipefail

command -v pmtiles >/dev/null || { echo "pmtiles CLI not found: brew install pmtiles" >&2; exit 1; }

ID="${1:?id required (e.g. krakow)}"
LAT="${2:?latitude required}"
LNG="${3:?longitude required}"
RADIUS_KM="${4:-25}"
MAXZOOM="${5:-13}"

BBOX="$(python3 - "$LAT" "$LNG" "$RADIUS_KM" <<'PY'
import math, sys
lat, lng, r = map(float, sys.argv[1:4])
dlat = r / 111.32
dlng = r / (111.32 * math.cos(math.radians(lat)))
print(f"{lng - dlng:.4f},{lat - dlat:.4f},{lng + dlng:.4f},{lat + dlat:.4f}")
PY
)"

BUILD_DATE="${PROTOMAPS_BUILD:-$(date -u -v-1d +%Y%m%d 2>/dev/null || date -u -d yesterday +%Y%m%d)}"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/out"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/area-$ID.pmtiles"

echo "bbox $BBOX (radius ${RADIUS_KM} km, zoom <= $MAXZOOM, build $BUILD_DATE)"
pmtiles extract "https://build.protomaps.com/${BUILD_DATE}.pmtiles" "$OUT" --bbox="$BBOX" --maxzoom="$MAXZOOM"

BYTES="$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")"
cat <<JSON

Add to packs/areas.json (set "url" once the file is hosted):
  { "id": "$ID", "name": "<place name>", "center": [$LNG, $LAT], "radiusKm": $RADIUS_KM, "maxZoom": $MAXZOOM, "mb": $(( (BYTES + 999999) / 1000000 )), "bbox": [${BBOX}] }
JSON
