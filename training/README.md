# Critterboard — Model Training

Two model families live here:

- **Vision classifier** (this README) — the EfficientNetV2-S that identifies the bug.
- **Persona LoRA adapters** ([`personas/`](personas/)) — three small adapters on top of Llama-3.2-1B that give Larva / Snail / Maywind their voice.

The vision pipeline is the **MVP blocker**. The persona pipeline is **deferred** — only worth running once the system-prompt approach in the app shows real drift in user testing (see [`../docs/ml-roadmap.md`](../docs/ml-roadmap.md) for the decision tree).

## Training dashboard (recommended)

A local Streamlit GUI in [`../tools/training-ui/`](../tools/training-ui/) wraps both pipelines with a visual interface — live logs, training-curve charts, an interactive inference tester, and one-click model copying. Use it instead of running the scripts by hand:

```bash
pip install -r tools/training-ui/requirements.txt
streamlit run tools/training-ui/app.py
```

The scripts can still be run directly from the command line as documented below — the dashboard just calls the same scripts as subprocesses.

---

## Vision classifier

Two tracks for producing the `.onnx` / `.mlpackage` files that the React Native app loads at runtime:

| Track | Where it runs | Species | Images | Wall clock | Top-1 | Top-3 |
|-------|---------------|---------|--------|-----------|-------|-------|
| **local/** | M2 MacBook (MPS) | 20 (Central EU) | ~3k | ~35 min | 70–85% | 90–97% |
| **kaggle/** | Kaggle T4 ×2 | 200 (full EU) | ~50k | ~8–10 h | 68–78% | 85–93% |
| **kaggle/** *(stretch)* | Kaggle T4 ×2 | 1000 | ~250k | ~15–20 h | 65–75% | 82–90% |

> Accuracy drops as the species count climbs — that's expected. The app UX leans on **top-3 candidates** in `Disambiguate` to absorb the slack.

---

## `local/` — MVP pipeline (20 species, ~2 GB, M2 Mac)

Use this to prove the whole pipeline end-to-end in an afternoon, then drop the resulting `insect_classifier.mlpackage` into the iOS bundle and watch `Scan` light up with real predictions instead of the hint string.

### One-time setup

```bash
cd training/local
pip install -r requirements.txt
```

### Step 1 — Download mini dataset (~20 min)

```bash
python 01_setup_and_download.py
```

Downloads ~150 images × 20 species from iNaturalist S3.
Output: `./data/images/<taxon_id>/` folders.

### Step 2 — Train (~30–40 min on M2)

```bash
python 02_train.py
```

Two-phase fine-tune of `EfficientNetV2-S`:

- **Phase 1** — 3 epochs warming up the classifier head only (rest of the network frozen)
- **Phase 2** — 17 epochs full fine-tune (all layers trainable, cosine LR schedule)

Best checkpoint saved to `./checkpoints/best_model.pth`.

### Step 3 — Verify inference works

```bash
python 03_inference_test.py --demo
```

Runs on a random dataset image and prints top-3 predictions with a tiny ASCII bar chart.

Point it at your own photo:

```bash
python 03_inference_test.py --image ~/Desktop/bee_photo.jpg
python 03_inference_test.py --image ~/Desktop/bee_photo.jpg --top 5
```

### Step 4 — Export for mobile

```bash
python 04_export.py
```

Produces:

- `./exported/insect_classifier.onnx` → Android (ONNX Runtime)
- `./exported/insect_classifier.mlpackage` → iOS (drag into Xcode, use via `VNCoreMLModel`)

Drop both into [`../assets/models/`](../assets/models/) and flip `USE_NATIVE_VISION = true` in [`../src/ai/index.ts`](../src/ai/index.ts).

---

## `kaggle/` — Full EU pipeline (200+ species)

Uses Kaggle's free T4 ×2 GPU quota. Same `EfficientNetV2-S`, same two-phase recipe — just more data, more epochs, AMP (mixed precision) enabled.

### One-time Kaggle setup

1. Create account at [kaggle.com](https://kaggle.com)
2. `New Notebook`
3. `Settings → Accelerator → GPU T4 x2`
4. `Settings → Internet → On` (needed for the iNaturalist API)
5. Upload `kaggle/insect_classifier_training.ipynb`

### Configuration (top of notebook)

```python
CFG = {
    'iconic_taxon':         'Insecta',   # or 'Lepidoptera' for a faster first run
    'min_obs_per_species':  200,         # lower = more species, less per-class quality
    'images_per_species':   250,
    'max_species':          200,         # ~50k images, ~8h training
    # ...
}
```

Three quality knobs that change everything:

- **`iconic_taxon`** — start with `Lepidoptera` (butterflies/moths). Fewer visually-similar species = higher per-class accuracy. Add `Coleoptera`, then full `Insecta` once the head is stable.
- **`min_obs_per_species`** — `200` gives ~800–1200 EU species. `500` is faster (~400–600 species).
- **`max_species`** — hard cap; first full run should be `200` to get an ~8h baseline.

### Run

Click **Run All**. The notebook:

1. Queries iNaturalist API for the European species list
2. Downloads images directly into Kaggle scratch space (100 GB free)
3. Trains 30 epochs with AMP
4. Saves checkpoint to `/kaggle/working/output/`

### Download results

In the Kaggle Output panel, download:

- `best_model.pth` (~80–150 MB)
- `class_map.json` (~10 KB)

Copy both to your Mac's `training/local/checkpoints/`, then run `python 04_export.py` locally to produce the iOS/Android files.

---

## Troubleshooting

**MPS errors on Mac:**

```bash
# Fall back to CPU
PYTORCH_ENABLE_MPS_FALLBACK=1 python 02_train.py
```

**Out of memory on Kaggle:**

In `CFG`, drop `batch_size` from `128` to `64`.

**Download failures:**

iNaturalist API has rate limits. The scripts include delays — if you see many failures (e.g. `>10%` per species), increase `time.sleep(...)` in the fetch functions of `01_setup_and_download.py`.

**CoreML export fails:**

```bash
pip install --upgrade coremltools
xcode-select --install                # macOS 12+ only
```

---

## Persona LoRAs

See [`personas/README.md`](personas/README.md) for the five-step pipeline (seed → curate → train → eval → export GGUF). **Do not run that pipeline until system-prompt-only personas show drift in real user testing** — the decision criteria are in [`../docs/ml-roadmap.md`](../docs/ml-roadmap.md) § 2.2.
