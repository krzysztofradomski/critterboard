#!/usr/bin/env bash
# Household v3: add the forced species v2 dropped for having under 100 photos (bed bug,
# fruit fly, green peach aphid, pharaoh ant) as 1,004 classes, by fine-tuning household-v2
# for one epoch at 256 px instead of retraining. Re-run the same command to resume.
#
#   DATA=~/vdata1k RUN=~/runs/vits_household_v3 PY=~/mlenv/bin/python DEVICE=mps \
#     training/vision/household_finetune.sh
#
# DATA must be the household_retrain.sh data dir (stages 1-3 done): the selection only adds
# the forced species, so every other species keeps exactly its v2 photos and split.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="${DATA:?}"; RUN="${RUN:?}"; PY="${PY:-python3}"
V2="$HERE/results/household-v2"
export PYTORCH_ENABLE_MPS_FALLBACK=1  # see household_retrain.sh
case "$PY" in */*) PATH="$(dirname "$PY"):$PATH" ;; esac
mkdir -p "$RUN"

(cd "$DATA" && "$PY" "$HERE/select_commercial.py" --data . --top 1004 --min-photos 100 \
   --min-photos-forced 60 --per-species 250) | tee "$RUN/select_commercial.log"
"$PY" "$HERE/download.py" --data "$DATA/commercial" --threads 48 --short-side 224
[ -f "$RUN/report.json" ] || "$PY" "$HERE/train.py" --data "$DATA/commercial" \
  --arch vit_small_patch16_224 --weights "$DATA/vit_small_augreg_i21k_in1k_224.npz" --out "$RUN" \
  --init "$V2/best.pth" --init-labels "$V2/labels.csv" \
  --epochs 1 --start-size 256 --size 256 --batch "${BATCH:-48}" --workers 2 --lr 1e-4 \
  --drop-path 0.1 --ckpt-every 100 --device "${DEVICE:-auto}" 2>&1 | tee -a "$RUN/train.log"
[ -f "$RUN/fp32_256/model_fp32.pte" ] || (cd "$HERE" && "$PY" export.py --data "$DATA/commercial" \
  --arch vit_small_patch16_224 --ckpt "$RUN/best.pth" --out "$RUN/fp32_256" --size 256) 2>&1 | tee "$RUN/export.log"
"$PY" "$HERE/score_groups.py" --data "$DATA/commercial" --ckpt "$RUN/best.pth" --size 256 \
  --prev-ckpt "$V2/best.pth" --prev-labels "$V2/labels.csv" --out "$RUN/groups_256.json" \
  --device "${DEVICE:-auto}"
echo "== done $(date -u +%FT%TZ)"
