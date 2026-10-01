# Notices: models, data and icons

`#licensing`

The MIT licence in [`LICENSE`](LICENSE) covers the **source code**. The files below carry other terms. This is not legal advice.

## Species model: `packs/models/eu-1k-commercial-v1.pte`

- **Base weights:** Google ViT-S/16 AugReg checkpoint, © Google, [Apache License 2.0](packs/models/LICENSE-google-vit-apache-2.0.txt). Modified: fine-tuned for insect and spider classification.
- **Training photos:** 243,202 iNaturalist photos licensed **CC0** or **CC-BY 4.0**, by 5,551 photographers. They were used to train the model and are not reproduced. Credits: [`ATTRIBUTION.md`](training/vision/results/commercial-1k-v1/ATTRIBUTION.md), per-photo list in [`credits.csv.gz`](training/vision/results/commercial-1k-v1/credits.csv.gz).
- **If you redistribute the weights**, keep this notice, the Apache 2.0 text, the [model card](training/vision/results/commercial-1k-v1/MODEL_CARD.md) and the attribution files with them.
- **Not covered by MIT.** Whether the weights themselves get a separate licence is an open decision. Until then, treat the obligations above as the terms.

## Species icons: `packs/icons/`

Cartoons made from CC0 iNaturalist photos. See [`packs/icons/CREDITS.md`](packs/icons/CREDITS.md).

## Chat model: Gemma 4 E2B

Not in this repository. Downloaded by the user from Settings. Apache License 2.0, 4-bit GGUF conversion by Unsloth.

## Removed model: `eu-ce-v3`

The earlier 200-species model was trained on photos that included CC-BY-NC, -ND and -SA licences and on timm's ImageNet-1k ConvNeXt weights. It is **not licensed for redistribution or commercial use**. It was deleted from the tree and must not be republished. Its run reports stay in `training/vision/results/eu-ce-v3/` for reference only.
