#!/usr/bin/env bash
# Household/garden retrain: the full pipeline, resumable by stage (re-run the same
# command after an interruption; finished stages are skipped and train.py resumes
# from last.pth).
#
#   DATA=~/vdata1k RUN=~/runs/vits_household_v2 INIT=~/ckpt/best.pth \
#     training/vision/household_retrain.sh
#
# Env:
#   DATA     working data dir (~30 GB streamed, ~7 GB kept). Reusing the folder of an
#            earlier run keeps its downloaded photos.
#   RUN      training output dir (best.pth, last.pth, history.json, report.json)
#   INIT     eu-1k-commercial-v1 best.pth (release ckpt-eu-1k-commercial-v1),
#            SHA-256 ba067e5491411834c59b90d612d2ed1f12c5e395b420dceb033ec9627ae31f4d
#   WEIGHTS  Google ViT-S/16 AugReg .npz (downloaded here if missing), SHA-256 545815b4…
#   PY       python with torch, timm, executorch==1.0.1, pillow (default: python3)
#   BACKUP   1 = push last.pth to branch retrain-household-ckpt every 3 h (ckpt_backup.sh)
#   DEVICE   auto (default: CUDA, else Apple GPU via MPS, else CPU), cuda, mps or cpu
#   BATCH    training batch size (default 48, the recipe's); lower it if the GPU runs
#            out of memory (e.g. 24 on a 16 GB Mac)
# Needs: curl, gzip, mawk (macOS: brew install mawk coreutils).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="${DATA:?set DATA to a working directory}"
RUN="${RUN:?set RUN to the training output directory}"
INIT="${INIT:?set INIT to the eu-1k-commercial-v1 best.pth}"
PY="${PY:-python3}"
WEIGHTS="${WEIGHTS:-$DATA/vit_small_augreg_i21k_in1k_224.npz}"
WEIGHTS_URL=https://storage.googleapis.com/vit_models/augreg/S_16-i21k-300ep-lr_0.001-aug_light1-wd_0.03-do_0.0-sd_0.0--imagenet2012-steps_20k-lr_0.03-res_224.npz
export DATA
MARK="$DATA/.household_stages"
mkdir -p "$DATA" "$RUN" "$MARK"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
stage() { [ -f "$MARK/$1" ] && { echo "== skip $1"; return 1; }; echo "== $1 $(date -u +%FT%TZ)"; }
done_() { touch "$MARK/$1"; echo "== done $1 $(date -u +%FT%TZ)"; }

[ "$(sha256 "$INIT")" = ba067e5491411834c59b90d612d2ed1f12c5e395b420dceb033ec9627ae31f4d ] \
  || { echo "INIT is not the eu-1k-commercial-v1 best.pth (checksum mismatch)"; exit 1; }
if [ ! -f "$WEIGHTS" ]; then curl -fsSL "$WEIGHTS_URL" -o "$WEIGHTS"; fi
[ "$(sha256 "$WEIGHTS")" = 545815b4e770d2fa6ca4b3ccba7c16b035e474354e52d17ca197ea4efecbf4d3 ] \
  || { echo "WEIGHTS checksum mismatch"; exit 1; }

if stage 1_stream_obs; then "$HERE/stream_obs.sh"; done_ 1_stream_obs; fi
if stage 2_select_species; then "$PY" "$HERE/select_species.py" --data "$DATA" --top 1500; done_ 2_select_species; fi
if stage 3_stream_photos; then "$HERE/stream_commercial_photos.sh"; done_ 3_stream_photos; fi
if stage 4_select_commercial; then
  (cd "$DATA" && "$PY" "$HERE/select_commercial.py" --data . --top 1000 --min-photos 100 \
     --per-species 250) | tee "$RUN/select_commercial.log"
  done_ 4_select_commercial
fi
if stage 5_download; then
  "$PY" "$HERE/download.py" --data "$DATA/commercial" --threads 48 --short-side 224
  done_ 5_download
fi
if stage 6_prune; then
  # Drop photos an earlier run downloaded that this selection no longer uses.
  "$PY" - "$DATA/commercial/images" <<'EOF'
import csv, sys
from pathlib import Path
root = Path(sys.argv[1])
keep = {(r["split"], r["taxon_id"], r["photo_id"]) for r in csv.DictReader((root / "manifest.csv").open())}
removed = 0
for split in ("train", "val", "test"):
    for tdir in (root / split).iterdir() if (root / split).exists() else []:
        for f in tdir.glob("*.jpg"):
            if (split, tdir.name, f.stem) not in keep:
                f.unlink(); removed += 1
        if not any(tdir.iterdir()):
            tdir.rmdir()
print(f"pruned {removed} photos no longer selected; kept {len(keep)}")
EOF
  done_ 6_prune
fi
if stage 7_train; then
  if [ "${BACKUP:-0}" = 1 ]; then
    RUN="$RUN" MARK="$MARK" "$HERE/ckpt_backup.sh" >> "$RUN/backup.log" 2>&1 &
  fi
  # Warm start from eu-1k-commercial-v1; sizes 160 → 192 → 224 → 256 → 256.
  "$PY" "$HERE/train.py" --data "$DATA/commercial" --arch vit_small_patch16_224 \
    --weights "$WEIGHTS" --out "$RUN" \
    --init "$INIT" --init-labels "$HERE/results/commercial-1k-v1/labels.csv" \
    --epochs 5 --start-size 160 --size 256 --batch "${BATCH:-48}" --workers 2 --lr 3e-4 \
    --drop-path 0.1 --ckpt-every 100 --device "${DEVICE:-auto}" 2>&1 | tee -a "$RUN/train.log"
  done_ 7_train
fi
if stage 8_export; then
  (cd "$HERE" && "$PY" export.py --data "$DATA/commercial" --arch vit_small_patch16_224 \
     --ckpt "$RUN/best.pth" --out "$RUN/fp32_256" --size 256) 2>&1 | tee "$RUN/export.log"
  done_ 8_export
fi
echo "== all stages done $(date -u +%FT%TZ). Forced species dropped (if any): see $RUN/select_commercial.log"
