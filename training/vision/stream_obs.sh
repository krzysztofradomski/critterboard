#!/usr/bin/env bash
# Step 1: taxonomy + European insect/arachnid observations (research grade and
# needs ID; the grade is column 4), plus household_species.txt worldwide,
# streamed from the iNaturalist AWS Open Data dumps (no API, no full download).
#   DATA=/path/to/vdata training/vision/stream_obs.sh
set -euo pipefail
DATA="${DATA:?set DATA to a working directory}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BUCKET=https://inaturalist-open-data.s3.amazonaws.com
mkdir -p "$DATA" && cd "$DATA"

curl -sS "$BUCKET/taxa.csv.gz" | gzip -dc > taxa.tsv

# Active species under Insecta (47158) or Arachnida (47119).
mawk -F'\t' 'NR>1 && $4=="species" && $6=="true" && ($2 ~ /\/47158(\/|$)/ || $2 ~ /\/47119(\/|$)/) { print $1 }' \
  taxa.tsv > arthro_species.tsv
# Infraspecific taxa (subspecies, …) roll up to their species (last ancestry id).
mawk -F'\t' 'NR>1 && $6=="true" && ($2 ~ /\/47158\// || $2 ~ /\/47119\//) &&
  ($4=="subspecies" || $4=="variety" || $4=="form" || $4=="infrahybrid") { n=split($2,a,"/"); print $1"\t"a[n] }' \
  taxa.tsv > infra.tsv
# Household species (see household_species.txt): taken from anywhere in the world.
grep -v '^#' "$HERE/household_species.txt" | grep . | \
mawk -F'\t' 'NR==FNR { want[$0]=1; next } $4=="species" && $6=="true" && ($5 in want) { print $1 }' - taxa.tsv > household_ids.tsv

# Europe box, minus Anatolia / Cyprus / Levant.
curl -sS "$BUCKET/observations.csv.gz" | gzip -dc | \
mawk -F'\t' -v OFS='\t' '
  FILENAME=="arthro_species.tsv" { sp[$1]=$1; next }
  FILENAME=="infra.tsv"          { sp[$1]=$2; next }
  FILENAME=="household_ids.tsv"  { home[$1]=1; next }
  ($7=="research" || $7=="needs_id") && ($6 in sp) {
    lat=$3+0; lon=$4+0
    if ((sp[$6] in home) || (lat>=36 && lat<=71.5 && lon>=-25 && lon<=45 && !(lon>26.5 && lat<41))) print $1, $2, sp[$6], $7
  }' arthro_species.tsv infra.tsv household_ids.tsv - > eu_obs.tsv
wc -l household_ids.tsv eu_obs.tsv
