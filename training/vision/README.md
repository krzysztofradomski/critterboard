# Vision pipeline v3 — 200 European species

`#ml` `#vision` `#training`

Builds the `eu-ce` region-pack model: the 200 most-observed European insects and spiders on iNaturalist. See [[../../docs/ml-roadmap]] for where this fits.

Everything runs on a CPU. No iNaturalist API, Hugging Face or pytorch.org access is needed, which matters inside locked-down sandboxes.

- **Data:** the [iNaturalist AWS Open Data](https://github.com/inaturalist/inaturalist-open-data) bucket. Its metadata dumps are streamed and filtered on the fly, and photos are fetched from the same bucket.
- **Base weights:** timm's GitHub release assets or Google's ViT AugReg bucket.

## Steps

```bash
python3 -m venv ~/mlenv && ~/mlenv/bin/pip install -r training/vision/requirements.txt
export DATA=~/vdata

# 1. Taxonomy + European research-grade observations (streams ~13 GB, keeps ~0.5 GB)
training/vision/stream_obs.sh

# 2. Rank species, sample ≤400 observations each (≤3 per observer); split by photographer
#    (each photographer lands in exactly one of train/val/test, across all species)
~/mlenv/bin/python training/vision/select_species.py --data $DATA --top 200

# 3. First photo of each sampled observation (streams ~20 GB)
training/vision/stream_photos.sh

# 4. Download + resize to 256 px (writes images/manifest.csv with licenses)
~/mlenv/bin/python training/vision/download.py --data $DATA

# 5. Fine-tune (see train.py --help), 6. export + verify the .pte, 7. write the pack
#    (export needs the venv's bundled `flatc` on PATH: export PATH=~/mlenv/bin:$PATH)
~/mlenv/bin/python training/vision/train.py --data $DATA --arch <arch> --weights <file> --out runs/x
~/mlenv/bin/python training/vision/export.py --data $DATA --arch <arch> --ckpt runs/x/best.pth --out runs/x
~/mlenv/bin/python training/vision/build_pack.py --data $DATA --labels runs/x/labels.csv \
    --pack packs/eu-ce.json --version 3 --model-url <url>
```

## Results — eu-1k-commercial-v1 (Sep 2026)

A commercially usable 1,000-species model, **used by the app since pack `eu-ce` v4**. Built from CC0 + CC-BY photos only, on Google's Apache-2.0 ViT-S/16 AugReg weights. Full details, licence obligations and residual risks are in [`results/commercial-1k-v1/MODEL_CARD.md`](results/commercial-1k-v1/MODEL_CARD.md).

| | |
|---|---|
| Species | 1,000 (939 insects, 61 arachnids); 74.4% of European observations |
| Data | 243,202 CC0/CC-BY photos by 5,551 photographers; 202k / 15.5k / 25.3k split by photographer |
| **Test top-1 / top-3** | **78.2% / 90.1%**, measured on the exported `.pte` at 224 px over 25,338 photos. Slightly optimistic: split per species, not per photographer (see model card) |
| File | `packs/models/eu-1k-commercial-v1.pte`, fp32, 88.4 MB |

Pipeline for this variant: `stream_commercial_photos.sh`, then `select_commercial.py --top 1000 --min-photos 100 --per-species 250` (the shipped model used the older per-species split, see the model card), then `download.py --short-side 224`, `train.py` (resumable), `export.py` and `credits.py`.

## Results — eu-ce v3 (Sep 2026, superseded by v4)

> **Not licensed for reuse.** Trained on photos that include CC-BY-NC/ND/SA and on timm's ImageNet-1k weights. The `.pte` was deleted from the repo (see [[../../NOTICE]]); only the run reports remain.

| | |
|---|---|
| Species | 200 (186 insects, 14 arachnids); the least-observed has 7.8k European observations |
| Data | 79,987 photos: 65,809 train / 6,092 val / 8,085 test, split by photographer |
| Base model | **ConvNeXt-nano** (timm `convnext_nano.d1h_in1k`, 15M params) |
| Training | 6 epochs, AdamW, bf16, progressive 160→192 px, label smoothing 0.1, drop-path 0.1 (~3.5 h on 4 CPU cores) |
| **Test top-1 / top-3** | **83.7% / 94.0%** — measured by running the exported `.pte` at 224 px on all 8,085 test photos |
| File (deleted) | `eu-ce-v3.pte`, fp32, 60.4 MB, input 1×3×224×224, output 200 logits |
| Host CPU latency | ~55–70 ms per image (4 threads, x86); phones with XNNPACK are typically faster |

Run artefacts (species list with observation counts, training history, reports, photo manifest with licences) are in [`results/eu-ce-v3/`](results/eu-ce-v3/).

Previous model (v2): EfficientNetV2-S, 20 species, 77% top-1, no XNNPACK delegate.

**Pilot comparison** (1 epoch, 80 photos/species, 160 px, val top-1): ConvNeXt-nano 50.0%, ViT-S/16 in21k 47.2%, ViT-Ti/16 in21k 38.2%.

**Resolution:** trained up to 192 px, evaluated at 224 px (+2.9 points: 80.9% → 83.7%). This is the "FixRes" train/test resolution effect.

**Quantisation tried and rejected:** static int8 (15.6 MB) dropped to 74.8% top-1, because ConvNeXt's LayerNorm/GELU activations don't take PTQ well. Dynamic int8 on Linear layers kept accuracy (82.9% on 1k images) but produced no size saving with ExecuTorch 1.0.1. fp32 ships.

**Delegation:** all convolutions, GELU, add/mul and the classifier run on XNNPACK. The 19 LayerNorms and reshape/copy nodes run on the default kernels (ExecuTorch 1.0's XNNPACK backend doesn't delegate LayerNorm).

**Hardest species** (test top-1 ≈ 48–58%): look-alike groups. These are the *Sympetrum* darters (*striolatum*, *sanguineum*, *vulgatum*), *Pieris rapae* vs other whites, *Vespula germanica* vs *vulgaris*, the colour-variable *Harmonia axyridis*, and crab spiders. They are good candidates for the app's Disambiguate screen.

## Design notes

- **Species choice:** ranked by European research-grade observation count (Insecta + Arachnida, infraspecific taxa rolled up). The app's original 20 species are always included so existing ids and translations keep working.
- **No photographer leakage:** `splits.py` hashes each observer id into train, val or test, the same way for every species, so the test score measures generalisation to new people's photos. (The shipped `eu-1k-commercial-v1` was built before this fix, with a per-species split.)
- **Preprocessing matches the app:** `react-native-executorch` squashes the whole frame to the model input size (no crop) and applies softmax itself. So evaluation squashes too, and the model outputs raw logits.
- **Export:** `executorch==1.0.1`, the oldest 1.x exporter. The app's runtime (react-native-executorch 0.9.3) reads program format ET12 and ExecuTorch is backward compatible from 1.0, so an older exporter is the safe side. The model is lowered to the **XNNPACK** delegate; the v2 model ran on slow portable kernels.
- **Verification:** `export.py` runs the exported `.pte` with the ExecuTorch runtime on the whole test split. The reported accuracy is the shipped artefact's, not just the PyTorch model's.
- **Photo licences:** the open-data bucket only contains CC-licensed photos (CC0, CC-BY, CC-BY-NC, …). `images/manifest.csv` records the licence of every training photo.

## Hardware quirk worth knowing

On CPUs with AMX (Sapphire Rapids and later), bf16 matmuls reach ~1 TFLOP/s while depthwise convolutions gain nothing. Measured train throughput (bf16, 4 threads):

| Backbone | img/s |
|---|---|
| EfficientNet-B0 | ~6 |
| MobileNetV3-L | ~9 |
| ViT-Ti/16 | ~19 |
| ConvNeXt-nano | ~21 |
| RegNetY-016 | ~35 |

That is why mobile-style depthwise convnets are the slow option to *train* here.
