# Model card — `eu-1k-field-v7`

`#ml` `#vision` `#licensing`

The successor of [`eu-1k-household-v3`](../household-v3/MODEL_CARD.md). It covers the same 1,004 species, in the same class order, and was trained on the same training photos, with the same licensing. What changed: it was fine-tuned for two more epochs on **field shots**. Half the training photos were pasted small onto plant backgrounds and degraded the way the app's crops of phone photos are. It **can be used in a commercial app**: every training photo is CC0 or CC-BY, the background photos are CC0, and the base weights are Google's Apache-2.0 ViT. This is not legal advice.

| | |
|---|---|
| File | **In the app since pack `eu-ce` v14 (model v7):** `packs/models/eu-1k-field-v7-256.pte` (256 px input, ExecuTorch, XNNPACK delegate, fp32, 88.5 MB) |
| MD5 | `68c75780fadc704c29d6b923a2462f96` |
| Architecture | ViT-S/16 (timm `vit_small_patch16_224`, 22M params), warm-started from household-v3 |
| Classes | 1,004 species; `labels.csv` is identical to v3's, so the pack's `labelMap` is unchanged |
| **Clean test** | **82.4% top-1 / 92.7% top-3** on 24,595 held-out iNaturalist photos, split by photographer (v3: 82.8% / 93.1%) |
| **Fake phone shots** | small bugs, tapped: **46.0%** top-1 (v3: 22.6%); small bugs, auto search: **33.8%** (v3: 14.4%). Table below |
| Host latency | ~95 ms/image on an Apple M1 CPU (4 threads) |
| Runtime | Exported with `executorch==1.0.1` (ET12), for `react-native-executorch` 0.9 / ExecuTorch ≥ 1.0 |

## Why

Phone tests on an iPhone 13 mini gave wrong species and low confidence. The training photos are tightly framed iNaturalist shots. The app instead classifies square crops of 12 MP photos, where a bug can be a few dozen pixels wide on a busy background and the crop gets scaled up (see [[../../../../docs/ml-roadmap]], "Scan preprocessing"). v7 is trained on photos that look like those crops.

## How it was built

Code: `training/vision/` (`field_aug.py`, `field_eval.py`, `calibrate.py`, `scan_crops.py`). Run files (checkpoint, logs, package versions): branch `field-v7-results`.

1. **Data:** v3's exact 248,378 photos and split, re-downloaded by photo ID (`download.py --credits ../household-v3/credits.csv.gz`; 142 photos no longer exist, 4 of them test). Re-exporting v3 from this data gave a byte-identical `.pte` and 82.82% test top-1, so the setup is the same as v3's.
2. **Backgrounds:** 799 CC0 research-grade European plant photos from iNaturalist (`fetch_backgrounds.py`): 623 train and 176 test, split by a hash of the photo ID, listed in [`backgrounds.csv`](backgrounds.csv).
3. **Field shots** (`--field-p 0.5`): half the training photos are pasted at 30–90% of the crop onto a random train background, with a wide feathered edge so there is no hard rectangle. 30% of all photos are also degraded: scaled down 1–3× and back up, slightly blurred, sensor noise, JPEG quality 55–92.
4. **Fine-tune:** 2 epochs at 256 px from v3, AdamW lr 1e-4, label smoothing 0.1, drop-path 0.1, batch 48, on an Apple M1 (MPS, fp32), 5 h 51 min. Val top-1 went 79.8% → 81.9% across the two epochs.
5. **Confidence:** a temperature was fitted on fake shots of **val** photos run through the app's crop search. It came out at **T = 1.00**, so v7's scores already match its accuracy there, and no scaling is baked in.

## Fake phone shots

`field_eval.py synth --n 500`: one test photo per species (first 500 species), pasted onto a held-out test background in a 1512×2016 frame (half an iPhone photo).
- **Big:** the photo's long side is 0.7–1.0× the reticle.
- **Small:** 0.15–0.25× the reticle, about a fruit fly at full resolution.

Each shot goes through a Python copy of `src/ai/scanCrops.ts`:
- **Auto search:** 3×3 tiles plus 3 centred crops, groups combined as the app does.
- **Tap:** 3 squares around the bug.
- **Live:** the 1× reticle crop alone, the closest proxy for a live preview guess.

The last column is what the app does after a shot: it goes straight to Result when the top score is ≥ 0.7 and at least 0.15 ahead of the second (`Scan.tsx`). All numbers are in [`field.json`](field.json).

| | v3 top-1 / top-3 | **v7 top-1 / top-3** | v3 → v7 mean conf. | Straight to Result, v3 → v7 (right when it does) |
|---|---|---|---|---|
| Big, auto search | 74.6% / 84.2% | **78.4% / 89.0%** | 36% → 45% | 6% (100%) → 17% (98.8%) |
| Big, tapped | 79.8% / 89.0% | **81.2% / 90.0%** | 76% → 76% | 69% (93.9%) → 68% (95.9%) |
| Small, auto search | 14.4% / 21.0% | **33.8% / 44.0%** | 15% → 14% | 0% → 0% |
| Small, tapped | 22.6% / 29.2% | **46.0% / 59.6%** | 43% → 48% | 15% (64%) → 27% (87%) |

**Live preview guess** (1× reticle crop; the app auto-snaps at ≥ 0.85 twice in a row):
- **Big bugs:** 59.2% → **71.8%** top-1. A single frame reaches 0.85 19% → 28% of the time, and is right 96.8% → 97.9% of the time when it does.
- **Small bugs:** 1% → 5%. They almost never reach the threshold, since a reticle crop leaves a small bug tiny.

**Calibration alone doesn't help.** v3 with a temperature fitted on clean val photos (T = 0.75, sharper) snapped on small tapped bugs that were right only 52% of the time. v3 with a temperature fitted on fake val shots (T = 1.2) had the same accuracy as plain v3 with lower confidence. The gain is from training.

## Licensing and obligations

As v3 (see its "Licensing", "Obligations when you ship it" and "Residual risks"). The base weights are Apache 2.0 (ship `packs/models/LICENSE-google-vit-apache-2.0.txt` and say the weights were modified). The training photos are the same as v3's: **7,101 photographers** of 248,378 CC0/CC-BY 4.0 photos, credited in [`ATTRIBUTION.md`](ATTRIBUTION.md) and per photo in [`credits.csv.gz`](credits.csv.gz) (copied from v3). The 799 background photos are CC0, which needs no credit; they are listed in [`backgrounds.csv`](backgrounds.csv) anyway.

## Known limitations

- **The fake shots flatter v7.** They come from the same generator v7 was trained with, though on held-out photos and backgrounds. Real phone photos are the honest test: `field_eval.py photos --dir <folder> --pte <v3> <v7>` compares models side by side.
- **Auto-search confidence stays low** (45% mean on big bugs, which are right 78% of the time). Most of that comes from the app averaging its crop groups (`combineScores`), not from the model.
- **Small bugs are still hard:** under half are right even when tapped. When the app goes straight to Result for a small tapped bug, it is wrong about 1 time in 8 (v3: 1 in 3).
- **Live preview:** approximated by the 1× reticle crop of the shot. A real preview frame is lower resolution and is not simulated.
- **Clean photos:** 0.4 points lower top-1 than v3.
- Look-alike groups remain the hardest, as in v3.
