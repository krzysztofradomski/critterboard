# Model card — `eu-1k-commercial-v1`

`#ml` `#vision` `#licensing`

An insect and spider classifier for the **1,000 most-observed European species**. It was built so it **can be used in a commercial app**: every training photo is CC0 or CC-BY, and the base weights are Google's Apache-2.0 ViT. Read "Obligations" and "Residual risks" before shipping. This is not legal advice.

| | |
|---|---|
| File | `packs/models/eu-1k-commercial-v1.pte` (ExecuTorch, XNNPACK delegate, fp32, 88.4 MB) |
| SHA-256 | `0cfb5cf32b0f121711c7a3195cda727fdfc0bc26160d3b66dbb814adc3dfb625` |
| Architecture | ViT-S/16 (timm `vit_small_patch16_224`, 22M params) |
| Classes | 1,000 species: 939 insects, 61 arachnids. Order and Latin names in `labels.csv`, observation counts in `species.csv` |
| Coverage | These species account for **74.4%** of European research-grade iNaturalist observations |
| **Accuracy** | **78.2% top-1 / 90.1% top-3**. Measured by running the `.pte` itself on 25,338 held-out photos from photographers not seen in training |
| Host latency | ~84 ms/image on a 4-core x86 CPU; phones with XNNPACK are typically faster (not yet measured) |
| Runtime | Exported with `executorch==1.0.1` (program format ET12), for `react-native-executorch` 0.9 / ExecuTorch ≥ 1.0 runtimes. Verified in the ExecuTorch host runtime; **not yet run on a phone** |

## Inputs and outputs

- **Input:** `float32 [1, 3, 224, 224]`, RGB, the whole photo resized (squashed, no crop) to 224×224. Scale to 0–1, then normalise with ImageNet mean `(0.485, 0.456, 0.406)` and std `(0.229, 0.224, 0.225)`.
- **Output:** `float32 [1, 1000]` **logits**. Apply softmax yourself. Index *i* is row *i* of `labels.csv`.
- **It always picks one of the 1,000 species.** For photos of anything else, use a confidence threshold (for example, top-1 probability below 0.3 means "not sure").

## How it was built

1. **Species:** ranked all active Insecta/Arachnida species by European research-grade observations in the iNaturalist AWS Open Data dump (Aug 2026). Candidates were the top 1,500; the model uses the first 1,000 that have at least 100 usable photos. Only 6 of the top 1,000 were skipped.
2. **Photos:** the first photo of each observation, **licence CC0 or CC-BY only**. NonCommercial, NoDerivatives and ShareAlike photos were excluded.
   - At most 250 photos per species and 3 per photographer.
   - Train/val/test split by photographer: 202,320 / 15,536 / 25,338.
   - 243,202 photos in total, by 5,551 photographers (186,715 CC-BY, 56,487 CC0).
3. **Base weights:** Google ViT AugReg `S_16-i21k-300ep-…-imagenet2012-steps_20k-lr_0.03-res_224.npz` from `gs://vit_models/augreg`, SHA-256 `545815b4e770d2fa6ca4b3ccba7c16b035e474354e52d17ca197ea4efecbf4d3`.
4. **Training:** 5 epochs, AdamW (lr 3e-4 backbone / 3e-3 head), label smoothing 0.1, drop-path 0.1, bf16, progressive 160→192 px, about 9.5 h on 4 CPU cores. Evaluated and exported at 224 px (+2.4 points over 192).
5. **Export:** attention exported as explicit matmul + softmax so XNNPACK runs it. Only LayerNorm and reshape/copy ops stay on the default kernels.

Reproduce with the scripts in `training/vision/`: `stream_obs.sh`, `select_species.py`, `stream_commercial_photos.sh`, `select_commercial.py`, `download.py`, `train.py`, `export.py`, `credits.py`. See `training/vision/README.md`.

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

- **Look-alike species score low.** For example *Pyrgus malvoides* (6%, nearly identical to *P. malvae*), *Calliptamus barbarus*, *Coenagrion hastulatum*, *Chorthippus* grasshoppers, crab spiders and burnet moths (18–32%). Show top-3 candidates for these.
- **Photo skew:** photos are European, mostly of adults, and taken in daylight. Larvae and pinned specimens are under-represented.
- **No int8 build:** a static-int8 export (22.8 MB) did not load in the ExecuTorch 1.0.1 runtime, so only fp32 ships. Quantisation-aware training or a newer exporter is a follow-up.
