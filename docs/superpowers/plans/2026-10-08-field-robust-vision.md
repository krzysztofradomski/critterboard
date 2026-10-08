# Field-robust vision model (v7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

`#ml` `#vision` `#plan`

**Goal:** Make the on-device species model right more often, and less unsure, on real phone photos (small bugs, busy backgrounds, soft upscaled crops), without new field photos. Give a way to compare the old and new models on the user's own iPhone photos.

**Architecture:** Training photos are tightly framed iNaturalist shots. The app sends the model crops from phone photos where the bug is small and soft (see [[../../ml-roadmap]], "Scan preprocessing"). We (1) build a fake-phone-shot test that runs the real `.pte` through a Python copy of the app's crop search, (2) fine-tune `eu-1k-household-v3` with matching augmentations (bug photo pasted small onto plant backgrounds, then degraded), (3) bake a fitted temperature into the export so the confidence matches how often the model is right, and (4) ship it as pack `eu-ce` v14 (model v7) only if it beats v3. Models are compared on real photos with `field_eval.py photos`, on the Mac: the user AirDrops iPhone photos into a folder. No app change is needed.

**Tech Stack:** Python 3, PyTorch 2.9.1 (MPS), timm 1.0.30, torchvision 0.24.1, Pillow 12.3, executorch 1.0.1 (pinned: the app reads ET12); macOS `sips` for HEIC; Node 26 (`--experimental-strip-types`) only to get the TypeScript reference values.

**Spec:** this conversation (2026-10-08) and [[../../ml-roadmap]] "Scan preprocessing". The main facts are copied into Global Constraints.

## Global Constraints

- The class list and order are exactly `training/vision/results/household-v3/labels.csv` (1,004 species; same order as its `species.csv`). The app's labelMap depends on it.
- Training photos stay CC0/CC-BY only and are exactly v3's (`results/household-v3/credits.csv.gz`). Background photos are CC0 only; list them in a manifest anyway.
- Splits come from the `split` column of that `credits.csv.gz`. Never train on `test`. Fake-shot tests use test photos and test backgrounds only.
- Input `float32 [1,3,256,256]`, ImageNet mean/std, output 1,004 logits. ExecuTorch 1.0.1 export with the XNNPACK delegate, fp32.
- Python crop maths must match `src/ai/scanCrops.ts` exactly. JS `Math.round` rounds .5 up, so use `math.floor(x + 0.5)`, never Python's `round()`.
- Disk: about 16 GB free on the Mac (`df -h ~`, 2026-10-08). The venv (~3 GB), dataset (~5 GB) and runs (~1 GB) must fit. Check for ≥ 12 GB free before Task 1, Step 6.
- Training: `--device mps`, `PYTORCH_ENABLE_MPS_FALLBACK=1`, batch 48, workers 2, lr 1e-4, 256 px, warm start from v3. v3's 1 epoch at 256 px took 198 min (17.8 img/s).
- Big binaries (`best.pth`, run `.pte`s, logs) go on a results branch `field-v7-results`, like `household-v2-results`. Only the shipped `.pte` goes into `packs/models/` on main.
- Ship gate (Task 7):
  - clean test top-1 ≥ 82.0% (v3: 82.8%)
  - fake-shot top-1 higher than v3 in all four cells (big/small × auto/tap)
  - auto-snap precision (top ≥ 0.85) ≥ 90%
- Push only when the user says so.

## Review Focus

1. **Rounding drift between TS and Python crops.** A .5 pixel coordinate must land where the app puts it. Pinned by `test_scan_crops_match_typescript` with the TS output for a 3024×4032 photo (Task 2).
2. **HEIC and EXIF-rotated iPhone photos** in `field_eval.py photos`. They must be converted and turned upright, not fed in sideways or crash. Pinned by `test_load_upright_*` (Task 4).
3. **Missing or odd photo extensions** while re-downloading 248k photos (`jpeg`, `png`, deleted photos). Skip and count them; never stop the run. Pinned by `test_fetch_photo_tries_extensions` (Task 1).
4. **Test leakage:** a test photo or test background used in training. Pinned by `test_rows_from_credits_*` (split kept, Task 1) and `test_backgrounds_split_disjoint` (Task 3).
5. **Temperature applied in the wrong direction or twice.** Pinned by `test_scaled_divides_logits` and `test_fit_temperature_recovers_overconfidence` (Task 6).

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `training/vision/train.py` | port + modify | `--device/--init` from `household-v2-results`; add `--backgrounds`, `--field-p` |
| `training/vision/export.py` | port + modify | branch version; add `--temperature` (wraps the model) |
| `training/vision/test_warm_start.py` | port | existing warm-start tests |
| `training/vision/download.py` | modify | `--credits`: rebuild a run's dataset from its `credits.csv.gz`; try `jpg/jpeg/png` |
| `training/vision/scan_crops.py` | create | Python copy of the `src/ai/scanCrops.ts` geometry and score combining |
| `training/vision/field_aug.py` | create | paste a photo onto a background, degrade it; `FieldShot` training transform |
| `training/vision/fetch_backgrounds.py` | create | ~800 CC0 European plant photos from the iNaturalist API, split train/test |
| `training/vision/field_eval.py` | create | `synth`: fake phone shots → app crop search → `.pte`; `photos`: real photos, models side by side |
| `training/vision/calibrate.py` | create | fit one temperature on val logits |
| `training/vision/test_field.py` | create | tests for all of the above |
| `training/vision/README.md`, `results/field-v7/MODEL_CARD.md`, `docs/ml-roadmap.md`, `tasks/todo.md` | modify/create | docs |

All commands run from `training/vision/` with `PY=~/mlenv/bin/python` and `DATA=~/vdata-v7`, unless noted.

---

### Task 1: Training environment and dataset restored from v3's photo list

**Files:**
- Port: `training/vision/train.py`, `training/vision/export.py`, `training/vision/test_warm_start.py` (from `household-v2-results`)
- Modify: `training/vision/download.py`
- Test: `training/vision/test_field.py`

**Interfaces:**
- Produces:
  - `download.NotFound(Exception)`
  - `download.fetch_photo(photo_id: str, exts=("jpg","jpeg","png")) -> bytes | None`
  - `download.rows_from_credits(credits_gz: Path, species_csv: Path) -> list[tuple[str, None, str, str, str]]`, giving `(photo_id, ext, license, taxon_id, split)`
  - Data dir `$DATA` with v3's `species.csv` and `images/{train,val,test}/<taxon_id>/<photo_id>.jpg` at short side 224 (as v3)

- [ ] **Step 1: Branch and port the branch scripts**

```bash
git checkout -b field-v7
git checkout household-v2-results -- training/vision/train.py training/vision/export.py training/vision/test_warm_start.py
git diff --cached --stat   # expect only these three files
```

- [ ] **Step 2: Write failing tests for `--credits` and the extension fallback**

```python
# training/vision/test_field.py
"""Tests for the field-robust pipeline.  cd training/vision && python -m pytest test_field.py"""
import csv
import gzip

import download


def _write(tmp_path):
    sp = tmp_path / "species.csv"
    with sp.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["taxon_id", "latin"])
        w.writerow(["48484", "Harmonia axyridis"])
    cr = tmp_path / "credits.csv.gz"
    with gzip.open(cr, "wt", newline="") as f:
        w = csv.writer(f)
        w.writerow(["photo_id", "license", "photographer", "inaturalist_login", "species", "split", "source"])
        w.writerow(["1", "CC0", "A", "a", "Harmonia axyridis", "test", ""])
        w.writerow(["2", "CC-BY", "B", "b", "Harmonia axyridis", "train", ""])
        w.writerow(["3", "CC-BY", "C", "c", "Not in species", "train", ""])
    return cr, sp


def test_rows_from_credits_maps_latin_to_taxon_and_keeps_split(tmp_path):
    cr, sp = _write(tmp_path)
    assert download.rows_from_credits(cr, sp) == [
        ("1", None, "CC0", "48484", "test"), ("2", None, "CC-BY", "48484", "train")]


def test_fetch_photo_tries_extensions(monkeypatch):
    tried = []

    def fake(url):
        tried.append(url.rsplit(".", 1)[1])
        if url.endswith(".png"):
            return b"PNG"
        raise download.NotFound(url)

    monkeypatch.setattr(download, "fetch", fake)
    assert download.fetch_photo("7") == b"PNG"
    assert tried == ["jpg", "jpeg", "png"]

    def missing(url):
        raise download.NotFound(url)

    monkeypatch.setattr(download, "fetch", missing)
    assert download.fetch_photo("8") is None
```

- [ ] **Step 3: Run, expect FAIL** (`rows_from_credits`, `NotFound`, `fetch_photo` undefined)

Run: `cd training/vision && $PY -m pytest test_field.py -v`

- [ ] **Step 4: Implement in `download.py`**

Make `fetch()` raise `NotFound` on HTTP 403/404 (the S3 bucket answers 403 for missing keys) and `RuntimeError` on any other non-200. Then add (plus `import gzip`):

```python
class NotFound(Exception):
    pass


def fetch_photo(photo_id: str, exts=("jpg", "jpeg", "png")):
    """medium.<ext> for a photo whose extension isn't known (credits.csv.gz has none)."""
    for ext in exts:
        try:
            return fetch(f"{BUCKET}/{photo_id}/medium.{ext}")
        except NotFound:
            continue
    return None


def rows_from_credits(credits_gz: Path, species_csv: Path):
    """Rebuild a run's exact photo list and split from its credits.csv.gz."""
    with species_csv.open() as f:
        taxon = {r["latin"]: r["taxon_id"] for r in csv.DictReader(f)}
    with gzip.open(credits_gz, "rt") as f:
        return [(r["photo_id"], None, r["license"], taxon[r["species"]], r["split"])
                for r in csv.DictReader(f) if r["species"] in taxon]
```

In `process()`, call `fetch_photo(photo_id)` when `ext is None`, otherwise keep `fetch(f"{BUCKET}/{photo_id}/medium.{ext}")`. When the result is `None`, return the "missing" outcome the pool already counts. In `main()`, add `ap.add_argument("--credits", type=Path)`. When it's given, `rows = rows_from_credits(args.credits, args.data / "species.csv")` replaces the `sampled.tsv`/`photos.tsv` reading. The thread pool and manifest code stay as they are.

- [ ] **Step 5: Run tests, expect PASS** — `$PY -m pytest test_field.py test_warm_start.py -v`

- [ ] **Step 6: Create the venv and restore the data** (long-running: ~1–2 h download)

```bash
df -h ~                                  # need ≥ 12 GB free
python3 -m venv ~/mlenv
~/mlenv/bin/pip install -r requirements.txt pytest \
  "torch==2.9.1" "timm==1.0.30" "torchvision==0.24.1" "pillow==12.3.0" "numpy==2.5.3"
mkdir -p $DATA/v3 && cp results/household-v3/species.csv $DATA/ && cp results/household-v3/labels.csv $DATA/v3/
git show household-v2-results:training/vision/results/household-v3/best.pth > $DATA/v3/best.pth
curl -fsSL -o $DATA/vit_small_augreg_i21k_in1k_224.npz \
  https://storage.googleapis.com/vit_models/augreg/S_16-i21k-300ep-lr_0.001-aug_light1-wd_0.03-do_0.0-sd_0.0--imagenet2012-steps_20k-lr_0.03-res_224.npz
$PY download.py --data $DATA --credits results/household-v3/credits.csv.gz --threads 48 --short-side 224
```

Expected: about 248k photos written and a few hundred missing (deleted on iNaturalist). Record both counts.

- [ ] **Step 7: Check that the restored data reproduces v3**

Run: `PATH=~/mlenv/bin:$PATH $PY export.py --data $DATA --arch vit_small_patch16_224 --ckpt $DATA/v3/best.pth --out $DATA/v3 --size 256`

Expected: `test_top1` ≈ 0.828 (±0.003 for missing photos). If it's further off, stop: the split or class order is wrong. This also writes `$DATA/v3/model_fp32.pte`, the v3 baseline file.

- [ ] **Step 8: Commit**

```bash
git add training/vision/{train,export,download,test_warm_start,test_field}.py
git commit -m "Vision: port MPS/warm-start training to main; download.py rebuilds a run's dataset from its credits.csv.gz"
```

---

### Task 2: Python copy of the app's crop search

**Files:**
- Create: `training/vision/scan_crops.py`
- Test: `training/vision/test_field.py` (append)

**Interfaces:**
- Produces (rects are `(originX, originY, width, height)` ints; score maps are probability vectors over the 1,004 classes):
  - `reticle_in_photo(photo: (w,h), view: (w,h), reticle: (cx,cy,side), fit="cover") -> (cx,cy,side)`
  - `square_around(img, cx, cy, side) -> rect`
  - `crop_rects(img, area)`, `tap_rects(img, x, y)`, `tile_rects(img, area)`
  - `combine_scores(groups: list[list[np.ndarray]]) -> np.ndarray`
- Constants: `RETICLE_SCALES=(1, 1.6)`, `TAP_FRACS=(0.12, 0.25, 0.5)`, `TILE=0.4`, `TILE_STEP=0.3`, `CENTRE_FRAC=0.6`, `CROP_PX=320`. Also `APP_VIEW=(375, 812)` and `APP_RETICLE=(187.5, 0.46*812, 220)`: iPhone 13 mini points, from `Scan.tsx` `RETICLE=220`, `RETICLE_TOP=0.46`.

- [ ] **Step 1: Failing test with the TS reference values** (printed by `node --experimental-strip-types` from the pure functions of `scanCrops.ts` on 2026-10-08)

```python
import numpy as np

import scan_crops as sc


def test_scan_crops_match_typescript():
    img = (3024, 4032)
    area = sc.reticle_in_photo(img, sc.APP_VIEW, sc.APP_RETICLE)
    assert np.allclose(area, (1512, 1854.72, 1092.4137931034481))
    assert sc.tile_rects(img, area) == [
        (966, 1308, 437, 437), (966, 1636, 437, 437), (966, 1964, 437, 437),
        (1294, 1308, 437, 437), (1294, 1636, 437, 437), (1294, 1964, 437, 437),
        (1621, 1308, 437, 437), (1621, 1636, 437, 437), (1621, 1964, 437, 437)]
    assert sc.crop_rects(img, area) == [(966, 1309, 1092, 1092), (638, 981, 1748, 1748), (0, 343, 3024, 3024)]
    assert sc.tap_rects(img, 100, 4000) == [(0, 3669, 363, 363), (0, 3276, 756, 756), (0, 2520, 1512, 1512)]


def test_combine_scores_best_of_group_then_mean():
    a = [np.array([0.2, 0.1]), np.array([0.1, 0.7])]
    b = [np.array([0.6, 0.3])]
    assert np.allclose(sc.combine_scores([a, b]), [0.35, 0.5])
```

- [ ] **Step 2: Run, expect FAIL** (module missing)

- [ ] **Step 3: Implement `scan_crops.py`**

```python
"""Python copy of src/ai/scanCrops.ts (geometry + score combining), for host-side evaluation.

Keep in sync with the TS file; test_field.py pins this copy to values printed by the TS code.
JS Math.round rounds .5 up, hence jsround, never Python's round().
"""
import math

import numpy as np

RETICLE_SCALES = (1, 1.6)
TAP_FRACS = (0.12, 0.25, 0.5)
TILE = 0.4
TILE_STEP = 0.3
CENTRE_FRAC = 0.6
CROP_PX = 320
APP_VIEW = (375, 812)                    # iPhone 13 mini, points
APP_RETICLE = (187.5, 0.46 * 812, 220)   # Scan.tsx: RETICLE, RETICLE_TOP


def jsround(v):
    return math.floor(v + 0.5)


def reticle_in_photo(photo, view, reticle, fit="cover"):
    pick = max if fit == "cover" else min
    scale = pick(view[0] / photo[0], view[1] / photo[1])
    off_x = (view[0] - photo[0] * scale) / 2
    off_y = (view[1] - photo[1] * scale) / 2
    cx, cy, side = reticle
    return ((cx - off_x) / scale, (cy - off_y) / scale, side / scale)


def square_around(img, cx, cy, side):
    s = jsround(min(side, img[0], img[1]))

    def clamp(v, hi):
        return jsround(min(max(v, 0), hi))

    return (clamp(cx - s / 2, img[0] - s), clamp(cy - s / 2, img[1] - s), s, s)


def crop_rects(img, area):
    cx, cy, side = area
    sides = [k * side for k in RETICLE_SCALES] + [min(img)]
    return [square_around(img, cx, cy, s) for s in sides]


def tap_rects(img, x, y):
    return [square_around(img, x, y, f * min(img)) for f in TAP_FRACS]


def tile_rects(img, area):
    cx, cy, a = area
    side = TILE * a
    n = jsround((1 - TILE) / TILE_STEP) + 1
    x0, y0 = cx - a / 2 + side / 2, cy - a / 2 + side / 2
    return [square_around(img, x0 + i * TILE_STEP * a, y0 + j * TILE_STEP * a, side)
            for i in range(n) for j in range(n)]


def combine_scores(groups):
    best = [max(g, key=lambda p: p.max()) for g in groups if len(g)]
    return np.mean(best, axis=0)
```

- [ ] **Step 4: Run, expect PASS** — `$PY -m pytest test_field.py -v`

- [ ] **Step 5: Commit**

```bash
git add training/vision/scan_crops.py training/vision/test_field.py
git commit -m "Vision: Python copy of the app's scan crop search, pinned to the TypeScript values"
```

---

### Task 3: Backgrounds and the field augmentation

**Files:**
- Create: `training/vision/field_aug.py`, `training/vision/fetch_backgrounds.py`
- Test: `training/vision/test_field.py` (append)

**Interfaces:**
- Produces:
  - `$DATA/backgrounds/{train,test}/<photo_id>.jpg` + `$DATA/backgrounds/manifest.csv` (`photo_id, split, license, observer, url`)
  - `field_aug.bg_split(photo_id: str) -> "train" | "test"` (stable ~20% test)
  - `field_aug.paste(fg: Image, bg: Image, side: int, xy: (x, y)) -> Image`: `fg`'s long side scaled to `side`, feathered edge, top-left at `xy`, `bg` not modified
  - `field_aug.degrade(img: Image, rng: random.Random) -> Image`
  - `field_aug.FieldShot(backgrounds: list[Path], size: int)`, a callable `PIL -> PIL size×size`

- [ ] **Step 1: Failing tests**

```python
import random

from PIL import Image

import field_aug as fa


def test_backgrounds_split_disjoint():
    ids = [str(i) for i in range(1000)]
    test = {i for i in ids if fa.bg_split(i) == "test"}
    assert 150 <= len(test) <= 250                               # ~20%
    assert test == {i for i in ids if fa.bg_split(i) == "test"}  # deterministic


def test_paste_puts_fg_at_side_and_position():
    bg = Image.new("RGB", (400, 400), (0, 0, 255))
    fg = Image.new("RGB", (200, 100), (255, 0, 0))
    out = fa.paste(fg, bg, side=100, xy=(50, 60))
    assert out.size == (400, 400)
    assert out.getpixel((100, 85)) == (255, 0, 0)   # centre of the pasted 100×50 photo
    assert out.getpixel((10, 10)) == (0, 0, 255)    # background untouched
    assert bg.getpixel((100, 85)) == (0, 0, 255)    # input not modified


def test_field_shot_returns_square_of_size(tmp_path):
    p = tmp_path / "b.jpg"
    Image.new("RGB", (500, 375), (0, 128, 0)).save(p)
    shot = fa.FieldShot([p], size=256)(Image.new("RGB", (298, 224), (255, 0, 0)))
    assert shot.size == (256, 256) and shot.mode == "RGB"


def test_degrade_keeps_size_and_mode():
    out = fa.degrade(Image.new("RGB", (256, 256), (120, 80, 40)), random.Random(0))
    assert out.size == (256, 256) and out.mode == "RGB"
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `field_aug.py`**

```python
"""Make training photos look like the app's crops of phone photos.

A tightly framed iNaturalist photo is pasted, smaller, onto a plant background (feathered edge),
then degraded the way phone crops are: upscaled from fewer pixels, slightly soft, JPEG-compressed,
a little noisy. Why: docs/ml-roadmap.md, "Scan preprocessing".
"""
import hashlib
import io
import random
from pathlib import Path

from PIL import Image, ImageFilter


def bg_split(photo_id: str) -> str:
    """~20% of backgrounds are kept for the fake-shot test, by a stable hash of the id."""
    return "test" if hashlib.md5(photo_id.encode()).digest()[0] < 52 else "train"


def paste(fg, bg, side: int, xy):
    k = side / max(fg.size)
    fg = fg.resize((max(1, round(fg.width * k)), max(1, round(fg.height * k))), Image.BILINEAR)
    edge = max(1, min(fg.size) // 12)
    mask = Image.new("L", fg.size, 0)
    mask.paste(255, (edge, edge, fg.width - edge, fg.height - edge))
    mask = mask.filter(ImageFilter.GaussianBlur(edge / 2))
    out = bg.copy()
    out.paste(fg, xy, mask)
    return out


def degrade(img, rng: random.Random):
    w, h = img.size
    f = rng.uniform(1.0, 3.0)  # fewer real pixels, upscaled back
    if f > 1.05:
        img = img.resize((max(8, int(w / f)), max(8, int(h / f))), Image.BILINEAR).resize((w, h), Image.BILINEAR)
    if rng.random() < 0.5:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.2)))
    if rng.random() < 0.3:
        img = Image.blend(img, Image.effect_noise((w, h), rng.uniform(4, 12)).convert("RGB"), 0.06)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=rng.randint(55, 92))
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB")


class FieldShot:
    """Training transform: the photo pasted at 30–90% of the crop onto a random background square."""

    def __init__(self, backgrounds, size: int):
        self.backgrounds = [Path(p) for p in backgrounds]
        self.size = size

    def __call__(self, img):
        rng = random.Random(random.getrandbits(64))  # DataLoader seeds `random` per worker
        bg = Image.open(rng.choice(self.backgrounds)).convert("RGB")
        s = rng.randint(min(bg.size) // 2, min(bg.size))
        x, y = rng.randint(0, bg.width - s), rng.randint(0, bg.height - s)
        bg = bg.crop((x, y, x + s, y + s)).resize((self.size, self.size), Image.BILINEAR)
        side = int(self.size * rng.uniform(0.3, 0.9))
        k = side / max(img.size)
        fw, fh = int(img.width * k), int(img.height * k)
        out = paste(img, bg, side, (rng.randint(0, self.size - fw), rng.randint(0, self.size - fh)))
        return degrade(out, rng)
```

- [ ] **Step 4: Implement `fetch_backgrounds.py`** (a thin API client with no unit test; Step 6 checks its output)

```python
"""~800 CC0 research-grade European plant photos as busy backgrounds (iNaturalist API).

  python fetch_backgrounds.py --data $DATA [--pages 4]
"""
import argparse
import csv
import json
import time
import urllib.request
from pathlib import Path

from field_aug import bg_split

API = ("https://api.inaturalist.org/v1/observations?taxon_id=47126&place_id=97391"
       "&photo_license=cc0&quality_grade=research&per_page=200&order_by=id&page={}")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "critterboard-training"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--pages", type=int, default=4)
    args = ap.parse_args()
    root = args.data / "backgrounds"
    rows = []
    for page in range(1, args.pages + 1):
        for obs in json.loads(get(API.format(page)))["results"]:
            ph = obs["photos"][0]
            pid = str(ph["id"])
            split = bg_split(pid)
            dest = root / split / f"{pid}.jpg"
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                dest.write_bytes(get(ph["url"].replace("/square.", "/medium.")))
            rows.append([pid, split, "CC0", obs["user"]["login"], f"https://www.inaturalist.org/photos/{pid}"])
        time.sleep(1.0)  # iNaturalist asks for ≤ 1 request/s
    with (root / "manifest.csv").open("w", newline="") as f:
        csv.writer(f).writerows([["photo_id", "split", "license", "observer", "url"], *rows])
    print({s: sum(r[1] == s for r in rows) for s in ("train", "test")})


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run tests, expect PASS**

- [ ] **Step 6: Fetch and look**

Run `$PY fetch_backgrounds.py --data $DATA`. Expect about `{'train': 640, 'test': 160}`.

Save 16 `FieldShot` outputs of train photos as one contact sheet in the scratchpad and look at it. Bugs should be visible, smaller and softer than the originals, on foliage. Adjust the ranges if they look wrong (for example a bug shrunk to a speck).

- [ ] **Step 7: Commit**

```bash
git add training/vision/field_aug.py training/vision/fetch_backgrounds.py training/vision/test_field.py
git commit -m "Vision: field augmentation (photo pasted small on a plant background, degraded) and CC0 background fetcher"
```

---

### Task 4: Fake-shot test and real-photo comparison (`field_eval.py`)

**Files:**
- Create: `training/vision/field_eval.py`
- Test: `training/vision/test_field.py` (append)

**Interfaces:**
- Consumes: `scan_crops.*` (Task 2), `field_aug.paste` (Task 3), `download.fetch_photo`, `download.rows_from_credits` (Task 1).
- Produces CLIs:
  - `field_eval.py synth --data $DATA --pte A.pte [B.pte …] --labels labels.csv --n 500 --out field.json`. For each model it writes `{"big/auto"|"big/tap"|"small/auto"|"small/tap": {n, top1, top3, mean_conf, snap_rate, snap_precision}}`.
  - `field_eval.py photos --dir ~/critterboard-field --pte A.pte B.pte --labels labels.csv`. It runs real photos through the app's gallery path and prints a markdown table with each model's top-3 and confidence side by side. When a file name starts with a Latin name (`Coccinella septempunctata 1.jpg`), it also scores top-1/top-3.
- Functions:
  - `load_upright(path) -> Image`: HEIC via `sips`, EXIF orientation applied
  - `app_crop(img, rect) -> Image`: crop → width min(320, side) → JPEG q90 → 256×256 bilinear, as the app does
  - `classify(method, img, rects) -> list[np.ndarray]`
  - `label_from_name(name, latin_to_idx) -> int | None`

Fake-shot design (a half-resolution iPhone frame, so the ≤500 px medium photos aren't upscaled much):
- Canvas 1512×2016 (portrait). A test background is resized to cover it. The shot gets phone JPEG q90 at the end.
- Area = `reticle_in_photo((1512, 2016), APP_VIEW, APP_RETICLE)` (side ≈ 546 px).
- `big`: photo long side = area side × U(0.7, 1.0). `small`: area side × U(0.15, 0.25), about a fruit fly at full resolution. The position is random, fully inside the area.
- `auto` = the app's camera path, `[tiles] + [[c] for c in centred]` through `combine_scores`. `tap` = `tap_rects` at the pasted photo's centre ± 3% of the short side, as one group.
- Photos: one test photo per species (seeded `random.Random(0)`) for the first `--n` species, fetched at medium size into `$DATA/field/photos/` (cached).
- `snap_rate` = share of shots with top probability ≥ 0.85. `snap_precision` = top-1 accuracy among those shots.

The real-photo path is the app's gallery path: `area = (w/2, h/2, CENTRE_FRAC*min(w,h))`, with groups `[tiles] + [[c] for c in centred] + [[whole photo]]`.

- [ ] **Step 1: Failing tests**

```python
import subprocess

from PIL import Image

import field_eval as fe


def test_load_upright_applies_exif_rotation(tmp_path):
    p = tmp_path / "r.jpg"
    img = Image.new("RGB", (40, 20), (255, 0, 0))
    exif = img.getexif()
    exif[0x0112] = 6  # display rotated 90° clockwise
    img.save(p, exif=exif)
    assert fe.load_upright(p).size == (20, 40)


def test_load_upright_converts_heic(tmp_path):
    jpg = tmp_path / "a.jpg"
    Image.new("RGB", (30, 10)).save(jpg)
    heic = tmp_path / "a.heic"
    subprocess.run(["sips", "-s", "format", "heic", str(jpg), "--out", str(heic)], check=True, capture_output=True)
    assert fe.load_upright(heic).size == (30, 10)


def test_app_crop_is_model_input_size():
    img = Image.new("RGB", (3024, 4032))
    assert fe.app_crop(img, (0, 0, 1000, 1000)).size == (256, 256)
    assert fe.app_crop(img, (0, 0, 120, 120)).size == (256, 256)    # small crop, upscaled
    assert fe.app_crop(img, (0, 0, 3024, 4032)).size == (256, 256)  # whole photo, squashed


def test_label_from_filename():
    idx = {"Coccinella septempunctata": 5}
    assert fe.label_from_name("Coccinella septempunctata 2.jpg", idx) == 5
    assert fe.label_from_name("IMG_1234.HEIC", idx) is None
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `field_eval.py`**

```python
"""Score .pte models the way the app uses them: crop search over a phone-sized photo.

  synth:  fake phone shots (a test photo pasted onto a test background), per size and path.
  photos: real photos from a folder (iPhone HEIC/JPEG), app gallery path, models side by side.

Resizing here is PIL bilinear; the app uses expo-image-manipulator and OpenCV, so expect
small differences against the phone, not different conclusions.
"""
import argparse
import csv
import io
import json
import random
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

import scan_crops as sc
from download import fetch_photo, rows_from_credits
from field_aug import paste

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
CANVAS = (1512, 2016)
SNAP = 0.85  # Scan.tsx AUTO_SNAP
CREDITS = Path(__file__).parent / "results/household-v3/credits.csv.gz"


def load_upright(path: Path):
    if path.suffix.lower() in (".heic", ".heif"):
        out = Path(tempfile.mkdtemp()) / (path.stem + ".jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", str(path), "--out", str(out)],
                       check=True, capture_output=True)
        path = out
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def jpeg(img, quality=90):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB")


def app_crop(img, rect):
    x, y, w, h = rect
    tw = min(sc.CROP_PX, w)
    c = img.crop((x, y, x + w, y + h)).resize((tw, round(h * tw / w)), Image.BILINEAR)
    return jpeg(c).resize((256, 256), Image.BILINEAR)


def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()


def classify(method, img, rects):
    import torch
    out = []
    for r in rects:
        x = (np.asarray(app_crop(img, r), np.float32) / 255 - MEAN) / STD
        t = torch.from_numpy(np.ascontiguousarray(x.transpose(2, 0, 1)[None]))
        out.append(softmax(method.execute([t])[0][0].numpy()))
    return out


def label_from_name(name, latin_to_idx):
    words = Path(name).stem.split()
    return latin_to_idx.get(" ".join(words[:2])) if len(words) >= 2 else None


def load_method(pte: Path):
    from executorch.runtime import Runtime
    return Runtime.get().load_program(str(pte)).load_method("forward")


def read_labels(path: Path):
    with path.open() as f:
        return [r["latin"] for r in sorted(csv.DictReader(f), key=lambda r: int(r["index"]))]


def cover(bg, size):
    k = max(size[0] / bg.width, size[1] / bg.height)
    bg = bg.resize((round(bg.width * k), round(bg.height * k)), Image.BILINEAR)
    x, y = (bg.width - size[0]) // 2, (bg.height - size[1]) // 2
    return bg.crop((x, y, x + size[0], y + size[1]))


def make_shots(data: Path, latin, n: int):
    """[(cond, label, shot, tap_xy)] and the search area; deterministic."""
    rng = random.Random(0)
    by_taxon = {}
    for pid, _ext, _lic, taxon, split in rows_from_credits(CREDITS, data / "species.csv"):
        if split == "test":
            by_taxon.setdefault(taxon, []).append(pid)
    with (data / "species.csv").open() as f:
        taxa = [(r["taxon_id"], r["latin"]) for r in csv.DictReader(f)]
    bgs = sorted((data / "backgrounds/test").glob("*.jpg"))
    cache = data / "field/photos"
    cache.mkdir(parents=True, exist_ok=True)
    area = sc.reticle_in_photo(CANVAS, sc.APP_VIEW, sc.APP_RETICLE)
    x0, y0, a = int(area[0] - area[2] / 2), int(area[1] - area[2] / 2), int(area[2])
    shots = []
    for i, (taxon, name) in enumerate(taxa[:n]):
        if taxon not in by_taxon:
            continue
        pid = rng.choice(sorted(by_taxon[taxon]))
        p = cache / f"{pid}.jpg"
        if not p.exists():
            raw = fetch_photo(pid)
            if raw is None:
                continue
            p.write_bytes(raw)
        photo = Image.open(p).convert("RGB")
        for cond, lo, hi in (("big", 0.7, 1.0), ("small", 0.15, 0.25)):
            bg = cover(Image.open(bgs[(2 * i + (cond == "small")) % len(bgs)]).convert("RGB"), CANVAS)
            side = int(a * rng.uniform(lo, hi))
            k = side / max(photo.size)
            fw, fh = int(photo.width * k), int(photo.height * k)
            x, y = x0 + rng.randint(0, a - fw), y0 + rng.randint(0, a - fh)
            shot = jpeg(paste(photo, bg, side, (x, y)))
            j = 0.03 * min(CANVAS)
            tap = (x + fw / 2 + rng.uniform(-j, j), y + fh / 2 + rng.uniform(-j, j))
            shots.append((cond, latin.index(name), shot, tap))
    return shots, area


def score(preds, labels):
    preds, labels = np.array(preds), np.array(labels)
    top3 = np.argsort(-preds, 1)[:, :3]
    conf = preds.max(1)
    hit1 = top3[:, 0] == labels
    snap = conf >= SNAP
    return {"n": int(len(labels)), "top1": float(hit1.mean()),
            "top3": float((top3 == labels[:, None]).any(1).mean()),
            "mean_conf": float(conf.mean()), "snap_rate": float(snap.mean()),
            "snap_precision": float(hit1[snap].mean()) if snap.any() else None}


def synth(args):
    latin = read_labels(args.labels)
    shots, area = make_shots(args.data, latin, args.n)
    report = {}
    for pte in args.pte:
        m = load_method(pte)
        acc = {}
        for cond, label, shot, tap in shots:
            tiles = classify(m, shot, sc.tile_rects(CANVAS, area))
            centred = classify(m, shot, sc.crop_rects(CANVAS, area))
            paths = {"auto": sc.combine_scores([tiles] + [[c] for c in centred]),
                     "tap": sc.combine_scores([classify(m, shot, sc.tap_rects(CANVAS, *tap))])}
            for path, p in paths.items():
                preds, labels = acc.setdefault(f"{cond}/{path}", ([], []))
                preds.append(p)
                labels.append(label)
        report[str(pte)] = {k: score(*v) for k, v in sorted(acc.items())}
        print(pte, json.dumps(report[str(pte)], indent=1), flush=True)
    args.out.write_text(json.dumps(report, indent=1))


def photos(args):
    latin = read_labels(args.labels)
    idx = {n: i for i, n in enumerate(latin)}
    methods = [(p.parent.name + "/" + p.stem, load_method(p)) for p in args.pte]
    files = sorted(f for f in args.dir.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".heic", ".png"))
    hits = {name: [0, 0] for name, _ in methods}
    labelled = 0
    print("| photo | " + " | ".join(name for name, _ in methods) + " |")
    print("|---|" + "---|" * len(methods))
    for f in files:
        img = load_upright(f)
        w, h = img.size
        area = (w / 2, h / 2, sc.CENTRE_FRAC * min(w, h))
        truth = label_from_name(f.name, idx)
        labelled += truth is not None
        cells = []
        for name, m in methods:
            tiles = classify(m, img, sc.tile_rects((w, h), area))
            centred = classify(m, img, sc.crop_rects((w, h), area))
            whole = classify(m, img, [(0, 0, w, h)])  # the app also squashes the untouched photo
            p = sc.combine_scores([tiles] + [[c] for c in centred] + [whole])
            top = np.argsort(-p)[:3]
            if truth is not None:
                hits[name][0] += int(top[0] == truth)
                hits[name][1] += int(truth in top)
            cells.append("<br>".join(f"{latin[k]} {p[k]:.0%}" for k in top))
        print(f"| {f.name} | " + " | ".join(cells) + " |", flush=True)
    for name, (t1, t3) in hits.items():
        if labelled:
            print(f"{name}: top-1 {t1}/{labelled}, top-3 {t3}/{labelled}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("synth")
    s.add_argument("--data", type=Path, required=True)
    s.add_argument("--n", type=int, default=500)
    s.add_argument("--out", type=Path, required=True)
    p = sub.add_parser("photos")
    p.add_argument("--dir", type=Path, required=True)
    for q in (s, p):
        q.add_argument("--pte", type=Path, nargs="+", required=True)
        q.add_argument("--labels", type=Path, required=True)
    args = ap.parse_args()
    (synth if args.cmd == "synth" else photos)(args)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Baseline v3** (~25 min: 1,000 shots × 15 inferences at ~90 ms)

```bash
$PY field_eval.py synth --data $DATA --pte $DATA/v3/model_fp32.pte --labels $DATA/v3/labels.csv \
  --n 500 --out $DATA/v3/field.json
```

Expected: `big/auto` top-1 roughly 50–60% and `small/auto` roughly 20–35%, in line with the roadmap's earlier measurements. Numbers far outside that mean the generator is off. Save and look at 8 shots before going on.

- [ ] **Step 6: Commit**

```bash
git add training/vision/field_eval.py training/vision/test_field.py
git commit -m "Vision: field_eval.py scores .pte models on fake phone shots and real photos through the app's crop search"
```

---

### Task 5: Train with the field augmentation

**Files:**
- Modify: `training/vision/train.py` (`train_tf`, args, the per-epoch dataset)
- Test: `training/vision/test_field.py` (append)

**Interfaces:**
- Consumes: `field_aug.FieldShot`, `field_aug.degrade` (Task 3).
- Produces: `train_tf(size, backgrounds=(), field_p=0.0)`; CLI `--backgrounds DIR --field-p P`. With no backgrounds or `field_p=0`, the transform is exactly the old one, so v3 stays reproducible.

- [ ] **Step 1: Failing tests**

```python
import train


def test_train_tf_without_backgrounds_is_unchanged():
    assert type(train.train_tf(256).transforms[0]).__name__ == "RandomResizedCrop"


def test_train_tf_with_field_p_gives_model_input(tmp_path):
    p = tmp_path / "b.jpg"
    Image.new("RGB", (500, 375), (0, 128, 0)).save(p)
    x = train.train_tf(256, backgrounds=[p], field_p=1.0)(Image.new("RGB", (298, 224), (255, 0, 0)))
    assert tuple(x.shape) == (3, 256, 256)
```

- [ ] **Step 2: Run, expect FAIL** (`train_tf` takes no `backgrounds`)

- [ ] **Step 3: Implement** (add `import random` and `from field_aug import FieldShot, degrade` at the top of `train.py`)

```python
class Degrade:
    def __call__(self, img):
        return degrade(img, random.Random(random.getrandbits(64)))


def train_tf(size, backgrounds=(), field_p=0.0):
    crop = T.RandomResizedCrop(size, scale=(0.3, 1.0), ratio=(0.6, 1.66))
    first = [crop] if not (backgrounds and field_p) else [
        T.RandomChoice([crop, FieldShot(backgrounds, size)], p=[1 - field_p, field_p]),
        T.RandomApply([Degrade()], p=0.3),  # big bugs in phone crops are soft too
    ]
    return T.Compose([
        *first,
        T.RandomHorizontalFlip(),
        T.TrivialAugmentWide(),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
        T.RandomErasing(p=0.2),
    ])
```

In `main()`, add `--backgrounds` (Path, optional) and `--field-p` (float, default 0.0). Build `bgs = sorted(args.backgrounds.glob("*.jpg")) if args.backgrounds else []` once. Where each epoch builds `Photos(..., train_tf(size), ...)`, pass `train_tf(size, bgs, args.field_p)`.

- [ ] **Step 4: Run tests, expect PASS** — `$PY -m pytest test_field.py test_warm_start.py -v`

- [ ] **Step 5: Benchmark the augmentation cost**

```bash
PYTORCH_ENABLE_MPS_FALLBACK=1 $PY train.py --data $DATA --arch vit_small_patch16_224 \
  --weights $DATA/vit_small_augreg_i21k_in1k_224.npz --init $DATA/v3/best.pth --init-labels $DATA/v3/labels.csv \
  --backgrounds $DATA/backgrounds/train --field-p 0.5 --epochs 2 --start-size 256 --size 256 \
  --batch 48 --workers 2 --lr 1e-4 --drop-path 0.1 --device mps --limit-steps 100 --out /tmp/v7-bench
```

Expected: ≥ 15 img/s (v3: 17.8). If it's lower, try `--workers 3`. Two epochs at 15 img/s take about 7.5 h.

- [ ] **Step 6: Commit** — `git commit -am "Vision: train.py --backgrounds/--field-p mixes field shots into training"`

- [ ] **Step 7: Full run** (overnight, resumable)

Run the same command without `--limit-steps`, with `--out ~/runs/v7 --ckpt-every 100`, in the background. Then `~/mlenv/bin/pip freeze > ~/runs/v7/requirements.lock.txt`. After a restart, re-run the same command and it resumes.

---

### Task 6: Temperature calibration and export

**Files:**
- Create: `training/vision/calibrate.py`
- Modify: `training/vision/export.py` (`Scaled`, `--temperature`)
- Test: `training/vision/test_field.py` (append)

**Interfaces:**
- Produces:
  - `calibrate.fit_temperature(logits: Tensor[N,C], labels: Tensor[N]) -> float`: grid 0.5–3.0, step 0.05, lowest NLL
  - the calibrate CLI writes `{"temperature", "nll_before", "nll_after"}` to `--out`
  - `export.Scaled(model, t)`, whose `forward(x)` is `model(x) / t`
  - `export.py --temperature T` (default 1.0 means no wrapper)

- [ ] **Step 1: Failing tests**

```python
import torch

import calibrate
import export


def test_fit_temperature_recovers_overconfidence():
    torch.manual_seed(0)
    labels = torch.randint(0, 10, (4000,))
    logits = torch.randn(4000, 10) + 2.0 * torch.nn.functional.one_hot(labels, 10)
    assert 1.8 <= calibrate.fit_temperature(logits * 2.0, labels) <= 2.2  # made 2× too sharp


def test_scaled_divides_logits():
    m = torch.nn.Linear(3, 2)
    x = torch.randn(1, 3)
    assert torch.allclose(export.Scaled(m, 2.0)(x), m(x) / 2.0)
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `calibrate.py`**

```python
"""Fit one temperature on the val split so softmax confidence matches accuracy (Guo et al. 2017).

  python calibrate.py --data $DATA --arch vit_small_patch16_224 --ckpt runs/v7/best.pth \\
      --size 256 --out runs/v7/temperature.json
"""
import argparse
import json
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from export import build
from train import Photos, eval_tf, load_species, pick_device


def fit_temperature(logits, labels):
    grid = torch.arange(0.5, 3.0001, 0.05)
    nll = torch.stack([F.cross_entropy(logits / t, labels) for t in grid])
    return round(grid[nll.argmin()].item(), 2)


@torch.no_grad()
def main():
    ap = argparse.ArgumentParser()
    for a in ("--data", "--ckpt", "--out"):
        ap.add_argument(a, type=Path, required=True)
    ap.add_argument("--arch", required=True)
    ap.add_argument("--size", type=int, default=256)
    args = ap.parse_args()
    dev = pick_device("auto")
    species = load_species(args.data)
    model = build(args.arch, args.ckpt, len(species), args.size).to(dev).eval()
    loader = DataLoader(Photos(args.data, "val", species, eval_tf(args.size)), batch_size=128, num_workers=2)
    zs, ys = [], []
    for x, y in loader:
        zs.append(model(x.to(dev)).float().cpu())
        ys.append(y)
    z, y = torch.cat(zs), torch.cat(ys)
    t = fit_temperature(z, y)
    rep = {"temperature": t, "nll_before": F.cross_entropy(z, y).item(),
           "nll_after": F.cross_entropy(z / t, y).item()}
    args.out.write_text(json.dumps(rep, indent=1))
    print(rep)


if __name__ == "__main__":
    main()
```

In `export.py`:

```python
class Scaled(torch.nn.Module):
    """Logits / T, baked into the .pte: the app's softmax then gives calibrated confidence."""

    def __init__(self, model, t: float):
        super().__init__()
        self.model, self.t = model, t

    def forward(self, x):
        return self.model(x) / self.t
```

Add `ap.add_argument("--temperature", type=float, default=1.0)`. Right after `build(...)`, add `if args.temperature != 1.0: model = Scaled(model, args.temperature).eval()`. Add `"temperature": args.temperature` to the report dict.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Calibrate and export both models.** v3 gets its own temperature too, which separates what training buys from what calibration buys.

```bash
export PATH=~/mlenv/bin:$PATH
$PY export.py --data $DATA --arch vit_small_patch16_224 --ckpt ~/runs/v7/best.pth --out ~/runs/v7 --size 256
for r in $DATA/v3 ~/runs/v7; do
  $PY calibrate.py --data $DATA --arch vit_small_patch16_224 --ckpt $r/best.pth --size 256 --out $r/temperature.json
  T=$($PY -c "import json;print(json.load(open('$r/temperature.json'))['temperature'])")
  $PY export.py --data $DATA --arch vit_small_patch16_224 --ckpt $r/best.pth --out $r/cal --size 256 --temperature $T
done
```

Expected: T is roughly 0.7–1.5. Label smoothing tends to make models *under*-confident on clean photos, so T < 1 (sharper) is plausible. The fit decides, not a guess.

- [ ] **Step 6: Commit**

```bash
git add training/vision/calibrate.py training/vision/export.py training/vision/test_field.py
git commit -m "Vision: fit a temperature on val and bake it into the .pte export"
```

---

### Task 7: Decide, compare, ship

**Files:**
- Create on main: `training/vision/results/field-v7/` with `MODEL_CARD.md`, `report.json`, `field.json`, `temperature.json`, `history.json`, `labels.csv`, `species.csv`, and v3's `credits.csv.gz` + `ATTRIBUTION.md` (same training photos).
- Create on branch `field-v7-results`: `best.pth`, the run `.pte`s, `train.log`, `export.log`, `requirements.lock.txt`.
- Modify: `packs/eu-ce.json`, `packs/manifest.json`, `packs/models/` (add the v7 `.pte`; remove the v3 `.pte` in a separate commit, as was done for v1), `training/vision/README.md`, `docs/ml-roadmap.md`, `tasks/todo.md`.

- [ ] **Step 1: Fake-shot comparison of all four models**

```bash
$PY field_eval.py synth --data $DATA --labels $DATA/v3/labels.csv --out ~/runs/v7/field.json --pte \
  $DATA/v3/model_fp32.pte $DATA/v3/cal/model_fp32.pte ~/runs/v7/model_fp32.pte ~/runs/v7/cal/model_fp32.pte
```

- [ ] **Step 2: Apply the ship gate** (Global Constraints). If v7 misses the clean-test floor, retry once with `--field-p 0.3`. If it misses again, ship only the calibrated v3 (a pure confidence fix) and write down why.

- [ ] **Step 3: Real photos, if the user has any**

The user AirDrops iPhone photos (HEIC is fine) to `~/critterboard-field/`, named `Genus species N.jpg` where the species is known. Then:

```bash
$PY field_eval.py photos --dir ~/critterboard-field --labels $DATA/v3/labels.csv \
  --pte $DATA/v3/model_fp32.pte ~/runs/v7/cal/model_fp32.pte
```

Paste the table to the user. When real photos and fake shots disagree, real photos win.

- [ ] **Step 4: Model card**

Write `results/field-v7/MODEL_CARD.md` in the style of `results/household-v3/MODEL_CARD.md`:
- what changed: field augmentation, 2 epochs from v3, temperature T
- clean and fake-shot tables, v3 vs v7
- the background photos (CC0, `manifest.csv`)
- the training photos: unchanged from v3, so the same credits

- [ ] **Step 5: Pack v14**

```bash
cp ~/runs/v7/cal/model_fp32.pte ../../packs/models/eu-1k-field-v7-256.pte
$PY build_pack.py --data $DATA --labels ~/runs/v7/cal/labels.csv --pack ../../packs/eu-ce.json --version 14 \
  --model-url https://raw.githubusercontent.com/krzysztofradomski/critterboard/main/packs/models/eu-1k-field-v7-256.pte
python3 ../../tools/packs/pin_checksums.py
```

`build_pack.py` bumps `modelVersion` to 7 by itself (the URL changed), and `pin_checksums.py` re-pins `modelBytes`/`modelMd5`. Check that `labelMap` is identical to v13's (same 1,004 classes and order): `git diff packs/eu-ce.json` should show only the version, the model fields and checksums.

- [ ] **Step 6: Check the app thresholds**

With calibrated confidences, read `snap_rate`/`snap_precision` from `field.json`. Change `AUTO_SNAP`/`LIVE_SHOW` in `src/screens/Scan.tsx` only if the numbers clearly call for it, for example ≥ 95% precision at 0.75 with twice the snap rate. Put any change in its own commit, with the numbers in the message, and run `pnpm test`.

- [ ] **Step 7: Docs**
  - `training/vision/README.md`: a "Results — eu-1k-field-v7" section
  - `docs/ml-roadmap.md` "Scan preprocessing": the fake-shot table, v3 vs v7
  - `tasks/todo.md`: tick items and add a review section

- [ ] **Step 8: Commits**
  - main: scripts and docs; pack v14 + model (a separate commit, easy to revert)
  - branch `field-v7-results`: the binaries

  Push only when the user says so. Installed apps then get the pack update, and the user tests on the iPhone.

---

## Not in this plan (add when needed)

- **Two models side by side in the app.** It needs a second model download (+88 MB), a hidden toggle, twice the inference time on Result (~2.6 s) and a TestFlight build. `field_eval.py photos` gives the same comparison on the Mac, from the same iPhone photos. Add it only if the live preview itself must be compared in the field.
- **The live-guess path** (preview frames, reticle crop only) isn't simulated. Its crop is close to the `big/auto` reticle crop.
- **Distillation from a bigger open model** (BioCLIP, a larger ViT). Only if v7 levels off. Check the licence first.
