# Notices: models, data and icons

`#licensing`

The MIT licence in [`LICENSE`](LICENSE) covers the **source code**. The files below carry other terms. This is not legal advice.

## Species model: `packs/models/eu-1k-household-v3-256.pte`

- **Base weights:** Google ViT-S/16 AugReg checkpoint, © Google, [Apache License 2.0](packs/models/LICENSE-google-vit-apache-2.0.txt). Modified: fine-tuned for insect and spider classification.
- **Training photos:** 248,378 iNaturalist photos licensed **CC0** or **CC-BY 4.0**, by 7,101 photographers. They were used to train the model and are not reproduced. Credits: [`ATTRIBUTION.md`](training/vision/results/household-v3/ATTRIBUTION.md), per-photo list in [`credits.csv.gz`](training/vision/results/household-v3/credits.csv.gz).
- **Licence of the fine-tuned weights:** [Apache License 2.0](packs/models/LICENSE-google-vit-apache-2.0.txt) (the same text applies), © 2026 Krzysztof Radomski, **with required attribution** (below). Commercial use is allowed.
- **Required attribution:** anyone who uses or redistributes the weights, or a model derived from them, must keep this notice and show, in their app's credits or documentation:

  > Uses the Critterboard species model by Krzysztof Radomski (https://github.com/krzysztofradomski/critterboard), a fine-tune of Google's Vision Transformer (AugReg, Apache 2.0), trained on iNaturalist photos under CC0 and CC-BY 4.0.

- **Also keep with the weights:** the Apache 2.0 text, the [model card](training/vision/results/household-v3/MODEL_CARD.md) and the photo attribution files above, since the CC-BY photographers must be credited.
- **No warranty.** Accuracy is measured on held-out photos only, see the model card. Not yet run on a phone.
- **Open points:** the legal status of training on CC photos and the ImageNet-21k provenance of the base weights are listed in the model card. Have a lawyer review before a commercial launch.

## Earlier model: `eu-1k-commercial-v1`

In the app from pack `eu-ce` v4 to v12, removed from the tree in v13 (still in the git history). Same terms as above; its credits and model card stay in [`training/vision/results/commercial-1k-v1/`](training/vision/results/commercial-1k-v1/).

## Species icons: `packs/icons/`

Cartoons made from CC0 iNaturalist photos. See [`packs/icons/CREDITS.md`](packs/icons/CREDITS.md).

## Chat model: Gemma 4 E2B

Not in this repository. Downloaded by the user from Settings. Apache License 2.0, 4-bit GGUF conversion by Unsloth.

## Removed model: `eu-ce-v3`

The earlier 200-species model was trained on photos that included CC-BY-NC, -ND and -SA licences and on timm's ImageNet-1k ConvNeXt weights. It is **not licensed for redistribution or commercial use**. It was deleted from the tree and must not be republished. Its run reports stay in `training/vision/results/eu-ce-v3/` for reference only.
