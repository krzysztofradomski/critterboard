#!/usr/bin/env bash
# Cut an offline map pack (PMTiles) for a bounding box out of the latest
# Protomaps daily planet build, without downloading the whole planet.
#
#   tools/map/extract.sh <name> <min_lon,min_lat,max_lon,max_lat> [maxzoom]
#   tools/map/extract.sh --sizes <min_lon,min_lat,max_lon,max_lat>
#
# Needs the pmtiles CLI: `brew install pmtiles` (or a go-pmtiles release).
# Output: tools/map/out/<name>.pmtiles (git-ignored).
set -euo pipefail

command -v pmtiles >/dev/null || { echo "pmtiles CLI not found: brew install pmtiles" >&2; exit 1; }

# Daily builds are published as YYYYMMDD.pmtiles and kept for about a week.
# Use yesterday's so today's build having not landed yet isn't a problem.
BUILD_DATE="${PROTOMAPS_BUILD:-$(date -u -v-1d +%Y%m%d 2>/dev/null || date -u -d yesterday +%Y%m%d)}"
SOURCE="https://build.protomaps.com/${BUILD_DATE}.pmtiles"
OUT_DIR="$(cd "$(dirname "$0")" && pwd)/out"

if [[ "${1:-}" == "--sizes" ]]; then
  mkdir -p "$OUT_DIR"
  BBOX="${2:?bbox required}"
  echo "Estimated pack size for bbox ${BBOX} (build ${BUILD_DATE}):"
  for z in 10 11 12 13 14 15; do
    printf "  maxzoom %-3s " "$z"
    # --dry-run plans the extract (tile count + bytes) without downloading tiles.
    pmtiles extract "$SOURCE" "$OUT_DIR/.dry-run.pmtiles" --bbox="$BBOX" --maxzoom="$z" --dry-run 2>&1 | tail -1
  done
  exit 0
fi

NAME="${1:?name required}"
BBOX="${2:?bbox required (min_lon,min_lat,max_lon,max_lat)}"
MAXZOOM="${3:-14}"

mkdir -p "$OUT_DIR"
pmtiles extract "$SOURCE" "$OUT_DIR/$NAME.pmtiles" --bbox="$BBOX" --maxzoom="$MAXZOOM"
ls -lh "$OUT_DIR/$NAME.pmtiles"
