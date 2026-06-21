# Session lessons

Patterns from corrections / refinements to avoid repeating.

## timm: an arch name existing ≠ pretrained weights existing

**Session**: EfficientNetV2-S fine-tune (`02_train.py`).

The script hardcoded `model_name="efficientnetv2_s"`. `timm.list_models()` lists it, so it
*looks* valid — but `create_model(..., pretrained=True)` raises `RuntimeError: No pretrained
weights exist for efficientnetv2_s`. The downloadable ImageNet weights live under the
TensorFlow-ported name `tf_efficientnetv2_s.*` (`.in1k`, `.in21k`, `.in21k_ft_in1k`).

**Rules:**
1. To check a timm model is *usable pretrained*, filter with `timm.list_models(pat, pretrained=True)`
   — not plain `list_models()`, which includes weightless arch defs.
2. Prefer `.in21k_ft_in1k` tags for fine-grained / look-alike classification — ImageNet-21k
   pretraining transfers noticeably better than plain in1k.
3. Smoke-test model construction (`create_model(pretrained=True)` + one forward pass) **before**
   launching a 30-min training run. Caught this in seconds instead of after a wasted run.

Result once fixed: test top-1 jumped 59% (lite, frozen MobileNetV3) → **77%** (fine-tuned
EfficientNetV2-S), top-3 93%. Backbone fine-tuning is what resolves intra-genus confusions
(e.g. *Apis mellifera* 12% → 75%).

## Verify external IDs before trusting a hardcoded dataset list

**Session**: training the local vision classifier.

`training/local/train_lite.py` (and `insect_data.py`) shipped 20 hardcoded iNaturalist
taxon IDs. **Every single one was stale.** Some returned `422 "Unknown taxon_id"`; worse,
several silently resolved to the *wrong species* (old `48484` labelled "Apis mellifera"
actually pointed at *Harmonia axyridis*), so the "successful" downloads were mislabelled —
a silent data-poisoning bug that training would happily learn from.

**Rules for next time:**
1. When a pipeline depends on external IDs (taxon IDs, API resource IDs, model hub slugs),
   **validate them against the live API before a long run** — don't assume hardcoded values
   are still correct. One cheap `/taxa?q=<name>` lookup per ID would have caught all 20.
2. Treat a partial-success download as a **red flag, not a shrug**. "8 of 20 classes" wasn't
   throttling; it was a sign the inputs were wrong. A direct single-request probe revealed the
   real error body immediately.
3. For a **bijective ID remap**, never use chained find-replace (old→new sets overlap, e.g.
   old `47219`→`51702` while another species moves *to* `47219`). Do a single-pass mapping
   evaluated against the original text.
4. iNaturalist `422` is its generic "bad request / unknown taxon" — not a rate-limit (that's
   `429`). Read the JSON `error` field instead of guessing.

## App Store concerns — explain before assuming

**Session**: localization OTA loader.

Mid-implementation the user asked "perhaps this is too complicated for MVP and will not be accepted into App Store with such an OTA loader?"

I'd built a full OTA pack loader without flagging the policy assumption first. The user reasonably worried about Apple 4.7.

**Rule for next time**: when building anything that touches remote code/content fetching for an iOS app, *up front*:

1. State the App Store policy reading explicitly (4.7 = executable code restricted, content/JSON is fine).
2. Cite the precedent (Duolingo, Slack, news apps all fetch JSON content).
3. Confirm the user actually wants the OTA capability, since the simpler bundle-only solution is half the code.

Don't bury this in implementation — it changes scope decisions.

## Translation packs: array vs nested object trade-off

Used `notes: ["...", "...", "..."]` in pack JSON for region notes. Initially typed `Dict` as `{ [k: string]: string | Dict }` which broke at JSON import.

**Rule**: when designing a recursive `Dict` type for translation packs, allow `string[]` as a leaf. Arrays are useful for ordered lists (notes, canned lines, tip series) where the consumer iterates by count. Resolver walks them via numeric string keys (`Array.isArray(cur) ? cur[Number(p)] : cur[p]`).

## Persona / data refactor sequence

When moving strings out of TS data files into JSON packs, the cleanest order is:

1. Author the en.json source-of-truth pack first.
2. Refactor data files (strip strings, keep IDs + numeric/visual fields).
3. Update consumers to use `t(key)` resolution.
4. Mirror packs into target languages.

Doing #4 before #2/#3 creates duplicate work because the key shapes change as you discover what consumers actually need.
