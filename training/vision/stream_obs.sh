#!/usr/bin/env bash
# Step 1: taxonomy + European research-grade insect/arachnid observations,
# streamed from the iNaturalist AWS Open Data dumps (no API, no full download).
#   DATA=/path/to/vdata training/vision/stream_obs.sh
set -euo pipefail
DATA="${DATA:?set DATA to a working directory}"
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

# Europe box, minus Anatolia / Cyprus / Levant.
curl -sS "$BUCKET/observations.csv.gz" | gzip -dc | \
mawk -F'\t' -v OFS='\t' '
  FILENAME=="arthro_species.tsv" { sp[$1]=$1; next }
  FILENAME=="infra.tsv"          { sp[$1]=$2; next }
  $7=="research" && ($6 in sp) {
    lat=$3+0; lon=$4+0
    if (lat>=36 && lat<=71.5 && lon>=-25 && lon<=45 && !(lon>26.5 && lat<41)) print $1, $2, sp[$6]
  }' arthro_species.tsv infra.tsv - > eu_obs.tsv
wc -l eu_obs.tsv
