#!/usr/bin/env bash
# Step 3: first photo of every sampled observation (after select_species.py).
# Output photos.tsv: photo_id, extension, license, obs_uuid
set -euo pipefail
DATA="${DATA:?set DATA to a working directory}"
cd "$DATA"
curl -sS https://inaturalist-open-data.s3.amazonaws.com/photos.csv.gz | gzip -dc | \
mawk -F'\t' -v OFS='\t' '
  FILENAME=="sampled.tsv" { want[$1]=1; next }
  ($3 in want) && $9=="0" { print $2, $5, $6, $3 }' sampled.tsv - > photos.tsv
wc -l photos.tsv
