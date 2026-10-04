# Model card — `eu-1k-commercial-v1`

`#ml` `#vision` `#licensing`

An insect and spider classifier for the **1,000 most-observed European species**. It was built so it **can be used in a commercial app**: every training photo is CC0 or CC-BY, and the base weights are Google's Apache-2.0 ViT. Read "Obligations" and "Residual risks" before shipping. This is not legal advice.

| | |
|---|---|
| File | **In the app since pack `eu-ce` v11 (model v5):** `packs/models/eu-1k-commercial-v1-256.pte` (256 px input, ExecuTorch, XNNPACK delegate, fp32, 88.5 MB). The original 224 px export `packs/models/eu-1k-commercial-v1.pte` (88.4 MB) is kept for rollback. Same weights; see "Input size" below |
| SHA-256 | 256 px: `c70594f04befe4b1e093c38d7fd379764530c8b2df88323afaa6957ba0e950ab` · 224 px: `0cfb5cf32b0f121711c7a3195cda727fdfc0bc26160d3b66dbb814adc3dfb625` |
| Architecture | ViT-S/16 (timm `vit_small_patch16_224`, 22M params) |
| Classes | 1,000 species: 939 insects, 61 arachnids. Order and Latin names in `labels.csv`, observation counts in `species.csv` |
| Coverage | These species account for **74.4%** of European research-grade iNaturalist observations |
| **Accuracy** | **78.2% top-1 / 90.1% top-3**. Measured by running the `.pte` itself on 25,338 held-out photos photos that were held out per species; the same photographers can appear in training for other species (see "How it was built"), so treat the score as slightly optimistic. **The 256 px export scores 80.5% top-1 / 92.2% top-3** (see "Input size") |
| Host latency | ~84 ms/image on a 4-core x86 CPU; phones with XNNPACK are typically faster (not yet measured) |
| Runtime | Exported with `executorch==1.0.1` (program format ET12), for `react-native-executorch` 0.9 / ExecuTorch ≥ 1.0 runtimes. Verified in the ExecuTorch host runtime; **not yet run on a phone** |

## Inputs and outputs

- **Input:** `float32 [1, 3, 256, 256]` for the 256 px file (`[1, 3, 224, 224]` for the 224 px one), RGB, the whole photo resized (squashed, no crop) to that size. In the app, Scan feeds square crops around the reticle instead of the whole photo (`src/ai/scanCrops.ts`). Scale to 0–1, then normalise with ImageNet mean `(0.485, 0.456, 0.406)` and std `(0.229, 0.224, 0.225)`.
- **Output:** `float32 [1, 1000]` **logits**. Apply softmax yourself. Index *i* is row *i* of `labels.csv`.
- **It always picks one of the 1,000 species.** For photos of anything else, use a confidence threshold (for example, top-1 probability below 0.3 means "not sure").

## Input size: why the app uses 256 px

The model was trained at 160–192 px and first exported at 224 px. A ViT can run at other sizes if its position grid is resampled, so the same weights were scored at several sizes (Oct 2026), with no extra training, on 4,994 held-out test photos (5 per species, iNaturalist `medium` images of about 500 px):

| Input | Top-1 | Top-3 |
|---|---|---|
| 224 px | 78.1% | 90.5% |
| **256 px** | **80.5%** | **92.2%** |
| 288 px | 80.6% | 92.2% |
| 320 px | 79.9% | 92.4% |
| 384 px | 76.9% | 90.8% |

- **256 px is the sweet spot.** 288 px is no better and costs more compute; larger sizes drift too far from the training size.
- **The 256 px `.pte` was verified itself:** 80.5% / 92.2% on the same photos (`pte_fp32_256_report.json`), with the same class order as the 224 px file.
- **Cost:** about 1.35× the compute per image in theory; on a Mac host both files ran at about the same speed (114 vs 121 ms). Not yet measured on a phone.
- **Reproduce:** `export.py --size 256` resamples the position grid at export time. Install timm only after pinning `torch>=2.9,<2.10`, or it upgrades PyTorch past what `executorch==1.0.1` needs.
- **The checkpoint** is the GitHub release asset [`ckpt-eu-1k-commercial-v1`](https://github.com/krzysztofradomski/critterboard/releases/tag/ckpt-eu-1k-commercial-v1) (`best.pth`, weights only).
- **Next step if needed:** a short fine-tune at 256 px would likely add a little more.

## How it was built

1. **Species:** ranked all active Insecta/Arachnida species by European research-grade observations in the iNaturalist AWS Open Data dump (Aug 2026). Candidates were the top 1,500; the model uses the first 1,000 that have at least 100 usable photos. Only 6 of the top 1,000 were skipped.
2. **Photos:** the first photo of each observation, **licence CC0 or CC-BY only**. NonCommercial, NoDerivatives and ShareAlike photos were excluded.
   - At most 250 photos per species and 3 per photographer.
   - Train/val/test split: 202,320 / 15,536 / 25,338. **The split was made per species**: a photographer was kept in one split *within* each species, but 2,974 of the 5,551 photographers appear in both train and test for different species. The scripts now split by photographer across all species (`splits.py`), and this model has not been re-evaluated that way.
   - 243,202 photos in total, by 5,551 photographers (186,715 CC-BY, 56,487 CC0).
3. **Base weights:** Google ViT AugReg `S_16-i21k-300ep-…-imagenet2012-steps_20k-lr_0.03-res_224.npz` from `gs://vit_models/augreg`, SHA-256 `545815b4e770d2fa6ca4b3ccba7c16b035e474354e52d17ca197ea4efecbf4d3`.
4. **Training:** 5 epochs, AdamW (lr 3e-4 backbone / 3e-3 head), label smoothing 0.1, drop-path 0.1, bf16, progressive 160→192 px, about 9.5 h on 4 CPU cores. Evaluated and exported at 224 px (+2.4 points over 192).
5. **Export:** attention exported as explicit matmul + softmax so XNNPACK runs it. Only LayerNorm and reshape/copy ops stay on the default kernels.

Reproduce with the scripts in `training/vision/`: `stream_obs.sh`, `select_species.py`, `stream_commercial_photos.sh`, `select_commercial.py`, `download.py`, `train.py`, `export.py`, `credits.py`. See `training/vision/README.md`.

## How the data was split, and what it means for the score

The photos were divided into **train** (the model learns from them), **val** (used to tune and pick the best epoch) and **test** (an exam the model never studies). The 78.2% is the score on the test photos.

For this model the division was made **per species**. For each species, some photographers were set aside for test and the rest went to train. Photographers were not tracked across species, so one person could be in test for ladybirds and in train for bees (2,974 of the 5,551 photographers appear in both).

- **What stays clean:** a test photo is never seen in training, and no photographer's photos of the *same species* appear on both sides. The model cannot score by recognising a person's earlier shots of that species.
- **What leaks:** the model may have picked up a photographer's camera, colours, lighting or favourite spots from their *other* species in train. That can help it slightly on their test photos.
- **Consequence:** the 78.2% / 90.1% is probably a little higher than what new users' photos will get. We have not measured by how much (a guess is one to two points, not more). Real-world accuracy depends on the phone camera and conditions anyway.
- **Nothing about the shipped model is affected:** only the reported score. The scripts now split by photographer across all species (`splits.py`). The first retrain will give a stricter number.

## Licensing

### Base weights — Apache 2.0 (Google)

- **Source:** Google's `google-research/vision_transformer` repository (Apache License 2.0), which publishes the AugReg checkpoints. Google states no additional non-commercial restriction.
- **timm's README:** *"The Google models do not appear to have any restriction beyond the Apache 2.0 license (and ImageNet concerns)."*
- **Contrast:** timm's own ImageNet-trained weights (such as the ConvNeXt behind `eu-ce-v3`) carry the author's note that *"one should assume that the original dataset license applies to the weights"*. That is why they were not used here.

### Training photos — CC0 and CC-BY

- **CC0:** no conditions.
- **CC-BY:** allows commercial use **with attribution**. `credits.csv.gz` lists every photo: id, licence, photographer name, iNaturalist login, species, split and source URL.

## Obligations when you ship it

1. **Apache 2.0 (base weights):** include a copy of the Apache License 2.0 and a notice such as *"Includes a model derived from Google's Vision Transformer (AugReg) checkpoints, © Google, licensed under the Apache License 2.0. Modified: fine-tuned for insect classification."*
2. **CC-BY (photos):** give attribution in a way reasonable for the medium. A common approach is an in-app "Model credits" screen that states the model was trained on photos by iNaturalist contributors under CC-BY 4.0 / CC0, with a link to the full list (host `credits.csv.gz` or a page generated from it) and a link to the licence. Say that the photos were used to train a model rather than being reproduced.
3. Keep `MODEL_CARD.md`, `labels.csv` and `credits.csv.gz` with the model file.

Critterboard does this in Settings → Open source libraries → **On-device models**. That section links this card, [`ATTRIBUTION.md`](ATTRIBUTION.md) (all 5,551 photographers) and the Apache 2.0 text (`packs/models/LICENSE-google-vit-apache-2.0.txt`).

## Residual risks

- **ImageNet-21k provenance:** the Google base weights were pretrained on ImageNet-21k, whose terms restrict *researchers* to non-commercial use. Google licenses the weights under Apache 2.0, and this setup is industry-standard, but it is not free of all doubt.
- **Uploader-declared licences:** iNaturalist licences are declared by the uploader. A mislicensed photo is possible, but rare.
- **Legal status of training:** EU law (DSM Directive Art. 4) permits text-and-data mining, including commercial, unless rights are reserved. CC0/CC-BY use does not depend on it, which is why only those licences were used.
- **Get a lawyer to review before a commercial launch.**

## Known limitations

- **Test score is slightly optimistic.** See "How the data was split" above.
- **Look-alike species score low.** For example *Pyrgus malvoides* (6%, nearly identical to *P. malvae*), *Calliptamus barbarus*, *Coenagrion hastulatum*, *Chorthippus* grasshoppers, crab spiders and burnet moths (18–32%). Show top-3 candidates for these.
- **Photo skew:** photos are European, mostly of adults, and taken in daylight. Larvae and pinned specimens are under-represented.
- **No int8 build:** a static-int8 export (22.8 MB) did not load in the ExecuTorch 1.0.1 runtime, so only fp32 ships. Quantisation-aware training or a newer exporter is a follow-up.
