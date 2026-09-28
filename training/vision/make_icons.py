"""Sticker-style species icons made from real photos.

For every species in the model's label list:
  1. take CC0 photos from the iNaturalist open-data candidates (CC-BY only if a
     species has no usable CC0 photo; those are listed in icon_credits.csv),
  2. rank them with the trained species model; for the best few, find the
     insect with the model's gradient-weighted attention map and cut exactly
     that object out with SAM (point + box prompt, via rembg). A salient-object
     cutter would keep the flower or leaf the insect sits on. Keep the photo
     whose cut-out alone the model still recognises best, weighted by mask
     quality (so photos where the insect is tiny lose),
  3. flatten it into a cartoon (mean-shift + k-means colours + ink lines) and
     frame it as a sticker (cream border, ink outline, hard shadow).

Resumable: species with an icon already in --out are skipped.
After review: --reject taxon_id=photo_id drops a bad pick and redoes that
species with the next best photo; --override taxon_id=photo_id forces one.

  python make_icons.py --data $DATA/commercial --labels results/commercial-1k-v1/labels.csv \\
      --ckpt runs/vits/best.pth --out icons/
"""

import argparse
import csv
import io
import random
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np
import timm
import torch
import urllib3
from PIL import Image
from rembg import new_session, remove
from torchvision import transforms as T

BUCKET = "https://inaturalist-open-data.s3.amazonaws.com/photos"
POOL = urllib3.PoolManager(maxsize=32, retries=urllib3.Retry(3, backoff_factor=1.0))
INK = np.array([26, 18, 8])
CREAM = np.array([255, 250, 239])
TF = T.Compose([T.Resize((224, 224)), T.ToTensor(),
                T.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225))])


def fetch(pid, ext, size):
    r = POOL.request("GET", f"{BUCKET}/{pid}/{size}.{ext}")
    if r.status != 200:
        raise IOError(r.status)
    return Image.open(io.BytesIO(r.data)).convert("RGB")


def heat_map(model, im, cls):
    """Gradient-weighted attention rollout for class `cls`, as an HxW map in 0..1."""
    attns = model._attns
    attns.clear()
    model.zero_grad()
    model(TF(im)[None])[0, cls].backward()
    n = attns[0].shape[-1]
    g = torch.eye(n)
    for a in attns:
        g = g + (a[0] * a.grad[0]).clamp(min=0).mean(0).detach() @ g
    side = int((n - 1) ** 0.5)
    h = g[0, 1:].reshape(side, side).numpy()
    h = cv2.resize(h, im.size, interpolation=cv2.INTER_CUBIC)
    h = cv2.GaussianBlur(h, (0, 0), im.width / 40).clip(0)
    return h / max(h.max(), 1e-9)


def insect_cutout(model, sam, med, big, cls):
    """Crop `big` around the model's attention peak (found on `med`) and SAM-mask that object.

    Returns (crop, mask). Insects are often small in the frame, so cropping
    first gives SAM and the sticker a well-framed, full-resolution subject.
    """
    h = heat_map(model, med, cls)
    py, px = np.unravel_index(h.argmax(), h.shape)
    ys, xs = np.where(h > 0.3)
    s = big.width / med.width
    bx0, by0, bx1, by1 = (int(v * s) for v in (xs.min(), ys.min(), xs.max(), ys.max()))
    side = int(max(bx1 - bx0, by1 - by0, 0.25 * min(big.size)) * 2.2)
    cx, cy = (bx0 + bx1) // 2, (by0 + by1) // 2
    x0 = int(np.clip(cx - side // 2, 0, max(0, big.width - side)))
    y0 = int(np.clip(cy - side // 2, 0, max(0, big.height - side)))
    crop = big.crop((x0, y0, min(big.width, x0 + side), min(big.height, y0 + side)))
    prompt = [{"type": "point", "data": [int(px * s) - x0, int(py * s) - y0], "label": 1},
              {"type": "rectangle", "data": _grow([bx0 - x0, by0 - y0, bx1 - x0, by1 - y0], 1.4, crop.size), "label": 1}]
    return crop, np.array(remove(crop, session=sam, only_mask=True, sam_prompt=prompt))


def _grow(box, f, size):
    """Scale a box about its centre (the heat box misses legs and antennae)."""
    cx, cy, hw, hh = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, (box[2] - box[0]) * f / 2, (box[3] - box[1]) * f / 2
    return [int(max(0, cx - hw)), int(max(0, cy - hh)), int(min(size[0] - 1, cx + hw)), int(min(size[1] - 1, cy + hh))]


def mask_quality(rgb, mk):
    """0..1: enough pixels on the insect for a crisp icon, one solid shape, sharp.

    The mask comes from a crop around the insect, so its share of the crop
    says little; what matters is the insect's size in pixels.
    """
    a = mk > 127
    frac = a.mean()
    if frac < 0.01 or frac > 0.75:  # nothing, or SAM took the background
        return 0.0
    size = min(1.0, a.sum() ** 0.5 / 150)
    n, _, st, _ = cv2.connectedComponentsWithStats(a.astype(np.uint8))
    dom = st[1:, cv2.CC_STAT_AREA].max() / a.sum() if n > 1 else 0
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    sharp = min(1.0, cv2.Laplacian(g, cv2.CV_64F)[a].var() / 400)
    return size * dom * (0.4 + 0.6 * sharp)


def sticker(img, mask, size=256):
    a = (mask > 127).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(a)
    if n > 1:
        a = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    ys, xs = np.where(a)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    side = int(max(y1 - y0, x1 - x0) * 1.25)
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    rgb = np.array(img)
    H, W = a.shape
    canvas = np.zeros((side, side, 3), np.uint8)
    cm = np.zeros((side, side), np.uint8)
    sy, sx = cy - side // 2, cx - side // 2
    ys0, xs0, ys1, xs1 = max(0, sy), max(0, sx), min(H, sy + side), min(W, sx + side)
    canvas[ys0 - sy:ys1 - sy, xs0 - sx:xs1 - sx] = rgb[ys0:ys1, xs0:xs1]
    cm[ys0 - sy:ys1 - sy, xs0 - sx:xs1 - sx] = a[ys0:ys1, xs0:xs1]
    S = 512
    canvas = cv2.resize(canvas, (S, S), interpolation=cv2.INTER_AREA)
    cm = cv2.resize(cm, (S, S), interpolation=cv2.INTER_NEAREST)

    # Cartoon: flatten, reduce to 7 colours, ink the longer edges.
    sm = cv2.pyrMeanShiftFiltering(canvas, 12, 28)
    sm = cv2.bilateralFilter(sm, 9, 50, 50)
    px = sm[cm > 0].reshape(-1, 3).astype(np.float32)
    _, lbl, cent = cv2.kmeans(px, 7, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0),
                              3, cv2.KMEANS_PP_CENTERS)
    cent = np.clip(cent * 1.08, 0, 255).astype(np.uint8)
    q = sm.copy()
    q[cm > 0] = cent[lbl.flatten()]
    q = cv2.medianBlur(q, 5)
    e = cv2.Canny(cv2.cvtColor(q, cv2.COLOR_RGB2GRAY), 60, 160)
    e[cv2.erode(cm, np.ones((5, 5), np.uint8)) == 0] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats((e > 0).astype(np.uint8), connectivity=8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 40
    e = cv2.dilate(np.where(keep[lab], 255, 0).astype(np.uint8), np.ones((2, 2), np.uint8))
    q[e > 0] = INK

    # Sticker frame: cream border, ink outline, hard offset shadow.
    border = cv2.dilate(cm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    outline = cv2.dilate(border, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    pad = 40
    F = S + 2 * pad
    out = np.zeros((F, F, 4), np.uint8)

    def place(m, color, off=(0, 0)):
        mm = np.zeros((F, F), np.uint8)
        mm[pad + off[1]:pad + off[1] + S, pad + off[0]:pad + off[0] + S] = m
        out[mm > 0, :3] = color
        out[mm > 0, 3] = 255

    place(outline, INK, (10, 10))
    place(outline, INK)
    place(border, CREAM)
    body = np.zeros((F, F), np.uint8)
    body[pad:pad + S, pad:pad + S] = cm
    qq = np.zeros((F, F, 3), np.uint8)
    qq[pad:pad + S, pad:pad + S] = q
    out[body > 0, :3] = qq[body > 0]
    sil = cv2.morphologyEx(body, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    out[sil > 0, :3] = INK
    return Image.fromarray(out).resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True, help="dir with cand.tsv (commercial candidates)")
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--ckpt", type=Path, required=True)
    ap.add_argument("--arch", default="vit_small_patch16_224")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--candidates", type=int, default=32)
    ap.add_argument("--cutouts", type=int, default=5)
    ap.add_argument("--limit", type=int, help="only the first N species (for trying settings)")
    ap.add_argument("--override", action="append", default=[], help="taxon_id=photo_id")
    ap.add_argument("--reject", action="append", default=[], help="taxon_id=photo_id (repeatable)")
    args = ap.parse_args()
    torch.set_num_threads(4)
    args.out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(0)

    labels = list(csv.DictReader(args.labels.open()))
    idx = {r["taxon_id"]: int(r["index"]) for r in labels}
    overrides = dict(o.split("=") for o in args.override)
    rejected = {}
    for o in args.reject:
        tid, pid = o.split("=")
        rejected.setdefault(tid, set()).add(pid)
    redo = set(overrides) | set(rejected)
    for tid in redo:
        (args.out / f"{tid}.webp").unlink(missing_ok=True)

    by_taxon = {}
    for line in (args.data / "cand.tsv").open():
        pid, ext, lic, _uuid, observer, tax = line.rstrip("\n").split("\t")
        if tax in idx and lic in ("CC0", "CC-BY"):
            by_taxon.setdefault(tax, []).append((pid, ext, lic, observer))

    model = timm.create_model(args.arch, num_classes=len(labels))
    model.load_state_dict(torch.load(args.ckpt, map_location="cpu"))
    model.eval()
    model._attns = []

    def keep_attn(_m, _i, o):  # attention probabilities (with grads) for heat_map
        if o.requires_grad:
            o.retain_grad()
            model._attns.append(o)

    for b in model.blocks:
        b.attn.fused_attn = False
        b.attn.attn_drop.register_forward_hook(keep_attn)
    sam = new_session("sam", sam_model="sam_vit_b_01ec64")
    log = args.out / "selection.csv"
    new_log = not log.exists()
    logf = log.open("a", newline="")
    w = csv.writer(logf)
    if new_log:
        w.writerow(["taxon_id", "latin", "photo_id", "license", "observer_id", "cutout_p", "mask_quality"])

    def prob(im, tax):
        with torch.no_grad():
            return model(TF(im)[None]).softmax(1)[0, idx[tax]].item()

    for n, r in enumerate(labels[: args.limit]):
        tax = r["taxon_id"]
        dest = args.out / f"{tax}.webp"
        if dest.exists():
            continue
        pool = [c for c in by_taxon.get(tax, []) if c[0] not in rejected.get(tax, ())]
        if tax in overrides:
            pool = [c for c in pool if c[0] == overrides[tax]] or [(overrides[tax], "jpg", "CC0", "")]
        cc0 = [c for c in pool if c[2] == "CC0"]
        pool = cc0 if len(cc0) >= 8 or tax in overrides else pool  # CC-BY only when CC0 is scarce
        cands = rng.sample(pool, min(args.candidates, len(pool)))
        with ThreadPoolExecutor(16) as ex:
            meds = list(ex.map(lambda c: (c, _safe(fetch, c[0], c[1], "medium")), cands))
        scored = sorted(((prob(im, tax), c, im) for c, im in meds if im is not None),
                        key=lambda t: -t[0])
        best = None
        for _p, c, im in scored[: args.cutouts]:
            big = _safe(fetch, c[0], c[1], "large") or im
            crop, mk = insect_cutout(model, sam, im, big, idx[tax])
            arr = np.array(crop)
            cut = np.where((mk > 127)[..., None], arr, np.full_like(arr, 128))
            pc, q = prob(Image.fromarray(cut), tax), mask_quality(arr, mk)
            if best is None or pc * q > best[0]:
                best = (pc * q, pc, q, c, crop, mk)
        if best is None or best[0] == 0:
            print(f"[{n}] {r['latin']}: no usable photo", flush=True)
            continue
        _, pc, q, (pid, ext, lic, observer), crop, mk = best
        icon = sticker(crop, mk)
        icon.save(dest, "WEBP", quality=85)
        w.writerow([tax, r["latin"], pid, lic, observer, f"{pc:.3f}", f"{q:.3f}"])
        logf.flush()
        print(f"[{n}] {r['latin']}: photo {pid} ({lic}) cutout_p={pc:.2f} quality={q:.2f}", flush=True)


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception:
        return None


if __name__ == "__main__":
    main()
