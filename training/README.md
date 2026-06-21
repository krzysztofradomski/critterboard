# Critterboard — Model Training

Two model families live here:

- **Vision classifier** (this file) — identifies the insect from a photo.
- **Persona LoRA adapters** ([`personas/`](personas/)) — small adapters on top of
  Llama-3.2-1B that give Larva / Snail / Maywind their voice.

The vision pipeline is the **MVP blocker**. The persona pipeline is **deferred** — only
worth running once the system-prompt approach shows real drift in user testing.

## Quick reference — which pipeline to use

| Goal | Pipeline | Time | Hardware |
|------|----------|------|----------|
| Prove the end-to-end on your laptop | `local/train_lite.py` | ~40 min | Any CPU |
| Offline / no internet | `local/train_lite.py --demo` | ~5 min | Any CPU |
| Production-quality 20-species model | `local/02_train.py` | ~35 min | M-series Mac |
| 200+ species, full EU | `kaggle/insect_classifier_training.ipynb` | ~8–10 h | Kaggle T4 ×2 |
| New insect pack (different region/theme) | See § Creating a new pack below | — | — |

---

## Training dashboard (optional GUI)

A local Streamlit GUI in [`../tools/training-ui/`](../tools/training-ui/) wraps both
pipelines with live logs, training curves, an inference tester, and one-click export:

```bash
pip install -r tools/training-ui/requirements.txt
streamlit run tools/training-ui/app.py
```

The dashboard calls the same scripts underneath — everything below works equally well
from the command line.

---

## `local/` — Lite pipeline  _(recommended starting point)_

`train_lite.py` uses **MobileNetV3-Small** (torchvision, 6 MB checkpoint) with frozen
ImageNet weights. It runs on any CPU in under an hour without a GPU.

### One-time setup

```bash
cd training/local
pip install -r requirements.txt
```

### Offline / demo mode (no internet needed)

Generates synthetic per-species colour+pattern images and trains on them. Useful for
CI, testing the export pipeline, or environments where iNaturalist is unreachable:

```bash
python train_lite.py --demo
```

Training finishes in ~5 minutes. Accuracy will be 100% on synthetic images — the model
is not usable for real photos until trained on real data (see next step).

### With real iNaturalist data

Downloads ~40 photos per species from iNaturalist's European bounding box
(lat 34–71, lon −25–45):

```bash
python train_lite.py
```

Options:

```
--images N     photos per class to download  (default: 40)
--epochs N     training epochs               (default: 40)
--batch N      batch size                    (default: 16)
--lr N         learning rate                 (default: 1e-3)
--workers N    dataloader workers            (default: 2)
--no-download  skip download, use existing ./data/ images
--demo         use synthetic images instead of downloading
```

Outputs:
- `checkpoints/best_model_lite.pth` — MobileNetV3-Small checkpoint (6 MB)
- `checkpoints/class_map_lite.json` — `{ "0": "Palomena prasina", … }`
- `checkpoints/history_lite.json` — per-epoch loss/accuracy

### Verify inference

```bash
python 03_inference_test.py --demo          # random image from the training set
python 03_inference_test.py --image ~/Desktop/bee.jpg --top 5
```

### Export for mobile

```bash
pip install onnx onnxruntime
python 04_export.py                   # ONNX + CoreML + updates src/ai/classMap.ts

# For react-native-executorch (.pte) — primary mobile path:
pip install executorch               # see https://pytorch.org/executorch/stable/getting-started-setup.html
python 04_export.py --pte
```

Then activate in the app:

1. Set `MODEL_SOURCE` in `src/ai/executorchVision.ts` to:
   ```ts
   require('../../assets/models/insect_classifier.pte')
   ```
2. Set `USE_NATIVE_VISION = true` in `src/ai/index.ts`
3. `npm install && expo prebuild && npx pod-install`

---

## `local/` — Full pipeline  _(higher accuracy, needs M-series Mac)_

`02_train.py` fine-tunes **EfficientNetV2-S** (timm) in two phases for better accuracy
on real photos. Requires `pip install timm` and works best with Apple MPS.

### Steps

```bash
cd training/local

# Step 1 — download ~150 images × 20 species (~20 min)
python 01_setup_and_download.py

# Step 2 — two-phase fine-tune (~35 min on M2)
python 02_train.py
# Outputs: checkpoints/best_model.pth

# Step 3 — sanity check
python 03_inference_test.py --demo

# Step 4 — export
python 04_export.py [--pte]
```

Two-phase training:
- **Phase 1** (3 epochs) — classifier head only, backbone frozen
- **Phase 2** (17 epochs) — full fine-tune, cosine LR schedule

---

## `kaggle/` — Full EU pipeline  _(200+ species)_

Same EfficientNetV2-S recipe with three config knobs. Uses Kaggle's free T4 ×2 GPU.

### Setup

1. [kaggle.com](https://kaggle.com) → New Notebook
2. Settings → Accelerator → **GPU T4 x2**
3. Settings → Internet → **On**
4. Upload `kaggle/insect_classifier_training.ipynb`

### Configuration

```python
CFG = {
    'iconic_taxon':        'Insecta',   # or 'Lepidoptera' for a faster first run
    'min_obs_per_species': 200,         # lower = more species, less per-class quality
    'images_per_species':  250,
    'max_species':         200,         # 200 → ~50k images, ~8h
}
```

Start with `'Lepidoptera'` and `max_species=50` for a fast sanity run (~1 h).

### After training

Download `best_model.pth` + `class_map.json` from Kaggle Output → copy both to
`training/local/checkpoints/` → run `python 04_export.py` locally.

---

## Creating a new insect pack

A "pack" is a combination of: a trained model, an updated `bugs.ts`, and an updated
`classMap.ts`. The steps below create a pack for a different region (e.g. North American
insects) or a different theme (e.g. UK garden species only).

### 1 — Define your species list

Open `training/local/insect_data.py` and add an entry for each new species following
the existing pattern. Each entry needs at minimum:

```python
{
    'taxon_id':       12345,           # iNaturalist taxon ID — find at inaturalist.org
    'scientific_name':'Apis mellifera',
    'common_name':    'Honey Bee',
    'order':          'Hymenoptera',
    'sources': [
        'https://www.inaturalist.org/taxa/12345',
        'https://en.wikipedia.org/wiki/Western_honey_bee',
    ],
    # … description, habitat, distribution, etc.
}
```

Find taxon IDs at `inaturalist.org/taxa/<name>` or via the search bar.

### 2 — Update the training species list

Open `training/local/train_lite.py` and update `SPECIES` (or the equivalent list) to
contain the taxon IDs for your new pack. The order here determines the class indices
in the exported model.

### 3 — Train

```bash
cd training/local
python train_lite.py                  # downloads iNaturalist photos for your species
# or
python train_lite.py --demo           # offline test with synthetic images
```

### 4 — Update the React Native app

**`src/data/bugs.ts`** — add a `Bug` entry for each new species:

```ts
{ id: 'mona', name: 'Monarch Butterfly', latin: 'Danaus plexippus',
  rarity: 'uncommon', xp: 40, tier: '★★', emoji: '🦋',
  color: '#e8782c', traits: ['butterfly', 'pollinator'] },
```

Choose a short 4-letter `id` that doesn't clash with existing ones.

**`src/ai/classMap.ts`** — either re-run `04_export.py` (which regenerates this file
automatically), or manually update `SCIENTIFIC_TO_BUG_ID` and `INDEX_TO_BUG_ID` to
match the new class order.

**`src/ai/executorchVision.ts`** — update `INSECT_LABELS` to match the new species and
their class indices.

### 5 — Export and activate

```bash
python 04_export.py --pte
```

Then follow the activation steps in `assets/models/README.md`.

---

## Species data sources

`training/local/insect_data.py` contains curated descriptions, habitat info, and
source links for all 20 current Central European species. Sources per species:

- **iNaturalist** — taxon page, observation photos, range maps
- **Wikipedia EN** — description and ecology
- **GBIF** — occurrence data and distribution
- **Butterfly Conservation UK** — butterfly/moth species profiles
- **Bumblebee Conservation Trust** — bumblebee species profiles
- **Buglife** — invertebrate fact sheets
- **IUCN Red List** — conservation status

When adding a new species, list at least one URL source in the `sources` array so the
Streamlit training UI and app species guide can link to it.

---

## Troubleshooting

**iNaturalist 403 / network errors** — the cloud training environment blocks outbound
HTTP. Use `--demo` for offline synthetic training, or run locally.

**iNaturalist 422 "Unknown taxon_id" / classes downloading 0 images** — the hardcoded
taxon IDs in `train_lite.py` and `insect_data.py` have gone stale (iNaturalist re-IDs
taxa over time). A `422` is *not* a rate-limit (that would be `429`); it means the ID no
longer exists, and a worse failure mode is an ID that silently resolves to the **wrong
species** — training then learns mislabelled data. Re-verify every ID before a run:

```bash
curl -s 'https://api.inaturalist.org/v1/taxa?q=Apis+mellifera&rank=species' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['results'][0]['id'])"
```

If you remap IDs in bulk, use a single-pass mapping (the swap is bijective — chained
find-replace corrupts overlapping old/new values).

**MPS errors on Mac:**

```bash
PYTORCH_ENABLE_MPS_FALLBACK=1 python 02_train.py
```

**PyTorch pretrained weight download fails:**

`train_lite.py` falls back to random weights automatically. Accuracy will be lower on
real photos — use the Kaggle pipeline or a Mac with internet for production.

**CoreML export fails:**

```bash
pip install --upgrade coremltools
xcode-select --install    # macOS 12+ only
```

**ExecuTorch install fails:**

ExecuTorch is Linux/Mac only and requires a C++ toolchain. Follow the official guide:
https://pytorch.org/executorch/stable/getting-started-setup.html

---

## Persona LoRAs

See [`personas/README.md`](personas/README.md) for the five-step pipeline.
**Do not run until system-prompt-only personas show drift in real user testing** —
the decision criteria are in [`../docs/ml-roadmap.md`](../docs/ml-roadmap.md) § 2.2.
