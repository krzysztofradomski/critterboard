# Model card — `eu-1k-household-v3`

`#ml` `#vision` `#licensing`

> **Replaced in the app by [`eu-1k-field-v7`](../field-v7/MODEL_CARD.md) since pack `eu-ce` v14 (model v7):** the same species and photos, fine-tuned on field shots. It is about twice as accurate on small bugs in fake phone shots.

The successor of [`eu-1k-commercial-v1`](../commercial-1k-v1/MODEL_CARD.md): the same architecture, input and licensing, with **1,004 species** that now include 41 home and garden species (flies, mosquitoes, cockroaches, ants, aphids, house spiders, bed bug, fruit fly…). Like v1 it **can be used in a commercial app**: every training photo is CC0 or CC-BY, and the base weights are Google's Apache-2.0 ViT. This is not legal advice.

| | |
|---|---|
| File | **In the app since pack `eu-ce` v13 (model v6):** `packs/models/eu-1k-household-v3-256.pte` (256 px input, ExecuTorch, XNNPACK delegate, fp32, 88.5 MB) |
| SHA-256 | `73b850f564954b623de331d97bed4897a197177dadbc60d84055d493981558ad` |
| Architecture | ViT-S/16 (timm `vit_small_patch16_224`, 22M params) |
| Classes | 1,004 species. Order and Latin names in `labels.csv`, observation counts in `species.csv` |
| **Accuracy** | **82.8% top-1 / 93.1% top-3**, measured by running the `.pte` on 24,599 held-out photos, split **by photographer** (no photographer appears in both training and test) |
| Host latency | ~91 ms/image on an Apple M1 CPU (4 threads) |
| Runtime | Exported with `executorch==1.0.1` (ET12), for `react-native-executorch` 0.9 / ExecuTorch ≥ 1.0 |

## Inputs and outputs

As v1, with 1,004 outputs: `float32 [1, 3, 256, 256]` RGB, scaled to 0–1 and ImageNet-normalised; `float32 [1, 1004]` **logits** (apply softmax). Index *i* is row *i* of `labels.csv`. It always picks one of its species, so use a confidence threshold for anything else.

## How it was built

1. **v2** (`../household-v2/`): `household_retrain.sh`. Species ranked by European research-grade + needs-ID observations, with the 61 forced species first (the app's original 20 and `household_species.txt`, the latter taken worldwide); up to 250 CC0/CC-BY photos per species, at most 3 per photographer; split by photographer (10% test, 6.5% val). Warm-started from v1 (896 classifier rows carried over), 5 epochs at 160 → 256 px, AdamW lr 3e-4, on an Apple M1 (MPS, fp32, batch 48), 9 h 10 min.
2. **v3** (this model): `household_finetune.sh` adds the four forced species v2 dropped for having under 100 photos (*Cimex lectularius*, *Drosophila melanogaster*, *Myzus persicae*, *Monomorium pharaonis*; 68–99 photos each) as new classes, by fine-tuning v2 for one epoch at 256 px (lr 1e-4). Every other species keeps exactly its v2 photos and split.

| Test, 256 px | v1 | v2 | v3 |
|---|---|---|---|
| Species carried over from v2, same photos | 80.8% / 91.7%* | 83.3% / 93.0% | 82.9% / 93.1% |
| Forced species | — | 77.9% / 90.3% | 76.6% / 89.3% (61 species) |
| The 4 new species (38 photos) | — | — | 44.7% / 71.1% |

\* v1 on v2's carried-over species. v1 was split per species, so some of these photos may have been in its training set: its score here is, if anything, flattered.

## Licensing and obligations

Exactly as v1 (see its "Licensing", "Obligations when you ship it" and "Residual risks"): the base weights are Apache 2.0 (ship `packs/models/LICENSE-google-vit-apache-2.0.txt` and say the weights were modified), and the training photos are CC0 or CC-BY 4.0. **CC-BY requires credit:** the **7,101 photographers** of the 248,378 training photos (190,635 CC-BY, 57,743 CC0) are listed in [`ATTRIBUTION.md`](ATTRIBUTION.md), per photo in [`credits.csv.gz`](credits.csv.gz). The app links both from Settings → Open source libraries.

## Known limitations

- The four new species have few photos to learn from and to be measured on: fruit fly 6/7, bed bug 8/17, green peach aphid 3/8, pharaoh ant 0/6 top-1 (4/6 in the top 3).
- Look-alike groups remain the hardest (small aphids, *Lasius* ants, house spiders, whites, *Vespula* wasps), as in v1.
- Household species are taken from observations worldwide, so their photos aren't only European.
