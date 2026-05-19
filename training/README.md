# Critterboard — Insect Classifier Training

Two tracks for producing the `.onnx` / `.mlpackage` files that the React Native app loads at runtime:

| Track | Where it runs | Species | Images | Wall clock | Top-1 | Top-3 |
|-------|---------------|---------|--------|-----------|-------|-------|
| **local/** | M2 MacBook (MPS) | 20 (Central EU) | ~3k | ~35 min | 70–85% | 90–97% |
| **kaggle/** | Kaggle T4 ×2 | 200 (full EU) | ~50k | ~8–10 h | 68–78% | 85–93% |
| **kaggle/** *(stretch)* | Kaggle T4 ×2 | 1000 | ~250k | ~15–20 h | 65–75% | 82–90% |

> Accuracy drops as the species count climbs — that's expected. The app UX leans on **top-3 candidates** in `Disambiguate` to absorb the slack.

## local/ — MVP pipeline

The 20-species mini run. Use this to prove the whole pipeline end-to-end in an afternoon, then drop the resulting `insect_classifier.mlpackage` into the iOS bundle and watch `Scan` light up with real predictions instead of the hint string.

```bash
cd training/local
pip install -r requirements.txt

python 01_setup_and_download.py   # ~20 min, downloads ~2 GB from iNaturalist S3
python 02_train.py                # ~35 min, EfficientNetV2-S, two-phase fine-tune
python 03_inference_test.py --demo
python 04_export.py               # produces ./exported/insect_classifier.{onnx,mlpackage}
```

Drop the exports into [`assets/models/`](../assets/models/).

## kaggle/ — Full EU pipeline

The 200-species (or 1000) run. Uses Kaggle's free T4 ×2 GPU quota. Same `EfficientNetV2-S`, same two-phase recipe — just more data, more epochs, AMP enabled.

1. Open `kaggle/insect_classifier_training.ipynb` in a new Kaggle notebook
2. `Settings → Accelerator → GPU T4 x2`
3. `Settings → Internet → On` (needed for the iNaturalist API)
4. Edit `CFG` at the top (`iconic_taxon`, `min_obs_per_species`, `max_species`)
5. `Run All`
6. From the Output panel, download `best_model.pth` + `class_map.json`
7. Drop them into `training/local/checkpoints/`, run `04_export.py` locally for the iOS/Android files

The notebook is self-contained — no separate dataset upload required, it pulls everything from the iNaturalist API at run time.

## Troubleshooting

```bash
# MPS-related errors on Mac
PYTORCH_ENABLE_MPS_FALLBACK=1 python 02_train.py

# CoreML export fails
pip install --upgrade coremltools
xcode-select --install                       # macOS 12+

# Kaggle OOM
# In CFG: 'batch_size': 128 → 64
```
