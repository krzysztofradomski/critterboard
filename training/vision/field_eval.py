"""Score .pte models the way the app uses them: crop search over a phone-sized photo.

  synth:  fake phone shots (a test photo pasted onto a test background), per size and path.
  photos: real photos from a folder (iPhone HEIC/JPEG), app gallery path, models side by side.

  python field_eval.py synth --data $DATA --pte a.pte b.pte --labels labels.csv --n 500 --out field.json
  python field_eval.py photos --dir ~/critterboard-field --pte a.pte b.pte --labels labels.csv

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
CANVAS = (1512, 2016)  # half an iPhone 12 MP frame, portrait: the ≤500 px test photos stay sharp
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
    """As scanCrops.ts + the classifier: crop, width ≤ 320, JPEG 0.9, squashed to 256×256."""
    x, y, w, h = rect
    tw = min(sc.CROP_PX, w)
    c = img.crop((x, y, x + w, y + h)).resize((tw, max(1, round(h * tw / w))), Image.BILINEAR)
    return jpeg(c).resize((256, 256), Image.BILINEAR)


def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()


def crop_logits(method, img, rects):
    import torch
    out = []
    for r in rects:
        x = (np.asarray(app_crop(img, r), np.float32) / 255 - MEAN) / STD
        t = torch.from_numpy(np.ascontiguousarray(x.transpose(2, 0, 1)[None]))
        out.append(method.execute([t])[0][0].numpy())
    return out


def classify(method, img, rects):
    return [softmax(z) for z in crop_logits(method, img, rects)]


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


def make_shots(data: Path, latin, n: int, split="test", backgrounds="test"):
    """[(cond, label, shot, tap_xy)] and the search area; deterministic. The test uses test
    photos on test backgrounds; calibrate.py uses val photos on train backgrounds."""
    rng = random.Random(0)
    by_taxon = {}
    for pid, _ext, _lic, taxon, photo_split in rows_from_credits(CREDITS, data / "species.csv"):
        if photo_split == split:
            by_taxon.setdefault(taxon, []).append(pid)
    with (data / "species.csv").open() as f:
        taxa = [(r["taxon_id"], r["latin"]) for r in csv.DictReader(f)]
    bgs = sorted((data / "backgrounds" / backgrounds).glob("*.jpg"))
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
