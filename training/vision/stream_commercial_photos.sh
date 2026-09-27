#!/usr/bin/env bash
# Commercial-use variant of step 3: every European observation of the chosen
# species (not just the sampled 400), keeping only first photos whose licence
# allows commercial use. NonCommercial photos are dropped; ND/SA are kept in the
# output and filtered by select_commercial.py (see README for why).
# Output (in $DATA/commercial/): cand.tsv = photo_id, ext, license, obs_uuid, observer_id, taxon_id
set -euo pipefail
DATA="${DATA:?set DATA to a working directory}"
cd "$DATA"
mkdir -p commercial
# obs_uuid -> taxon for all observations of the species in species.csv
mawk -F'\t' 'NR==FNR { want[$1]=1; next } ($3 in want) { print $1"\t"$3 }' \
  <(cut -d, -f1 species.csv | tail -n +2) eu_obs.tsv > commercial/obs_all.tsv
curl -sS https://inaturalist-open-data.s3.amazonaws.com/photos.csv.gz | gzip -dc | \
mawk -F'\t' -v OFS='\t' '
  NR==FNR { tax[$1]=$2; next }
  $9=="0" && ($3 in tax) && $6 !~ /NC/ { print $2, $5, $6, $3, $4, tax[$3] }' commercial/obs_all.tsv - > commercial/cand.tsv
wc -l commercial/obs_all.tsv commercial/cand.tsv
