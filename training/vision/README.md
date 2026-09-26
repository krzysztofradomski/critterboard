# Vision pipeline v3 — 200 European species

`#ml` `#vision` `#training`

Builds the `eu-ce` region-pack model: the 200 most-observed European insects and spiders on iNaturalist. See [[../../docs/ml-roadmap]] for where this fits.

Everything runs on a CPU. No iNaturalist API, Hugging Face or pytorch.org access is needed, which matters inside locked-down sandboxes.

- **Data:** the [iNaturalist AWS Open Data](https://github.com/inaturalist/inaturalist-open-data) bucket. Its metadata dumps are streamed and filtered on the fly, and photos are fetched from the same bucket.
- **Base weights:** timm's GitHub release assets or Google's ViT AugReg bucket.

## Steps

```bash
python3 -m venv ~/mlenv && ~/mlenv/bin/pip install "executorch==1.0.1" timm pillow numpy
export DATA=~/vdata

# 1. Taxonomy + European research-grade observations (streams ~13 GB, keeps ~0.5 GB)
training/vision/stream_obs.sh

# 2. Rank species, sample ≤400 observations each (≤3 per observer), split by observer
~/mlenv/bin/python training/vision/select_species.py --data $DATA --top 200

# 3. First photo of each sampled observation (streams ~20 GB)
training/vision/stream_photos.sh

# 4. Download + resize to 256 px (writes images/manifest.csv with licenses)
~/mlenv/bin/python training/vision/download.py --data $DATA

# 5. Fine-tune (see train.py --help), 6. export + verify the .pte, 7. write the pack
~/mlenv/bin/python training/vision/train.py --data $DATA --arch <arch> --weights <file> --out runs/x
~/mlenv/bin/python training/vision/export.py --data $DATA --arch <arch> --ckpt runs/x/best.pth --out runs/x
~/mlenv/bin/python training/vision/build_pack.py --data $DATA --labels runs/x/labels.csv \
    --pack packs/eu-ce.json --version 3 --model-url <url>
```

## Design notes

- **Species choice:** ranked by European research-grade observation count (Insecta + Arachnida, infraspecific taxa rolled up). The app's original 20 species are always included so existing ids and translations keep working.
- **No photographer leakage:** train, val and test are split by observer, so the test score measures generalisation to new people's photos.
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
