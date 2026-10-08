"""Fit one temperature on the val split so softmax confidence matches accuracy (Guo et al. 2017).

  python calibrate.py --data $DATA --arch vit_small_patch16_224 --ckpt runs/v7/best.pth \\
      --size 256 --out runs/v7/temperature.json [--field-pte runs/v7/model_fp32.pte]

With --field-pte (what ships): T is fitted on what the app shows, not on clean photos. Fake
phone shots from the val photos on train backgrounds go through the app's crop search (auto and
tap paths, field_eval.py) and T minimises the NLL of the combined scores. Clean val photos make a
label-smoothed model look under-confident (T < 1), but sharpening it that way makes small tapped
bugs snap wrongly; the combined crops are what the user sees.

Then export with `export.py --temperature T`: the .pte returns logits / T, so the app's
softmax gives calibrated confidences with no app change.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

import scan_crops as sc
from export import build
from train import Photos, eval_tf, load_species, pick_device


def fit_temperature(logits, labels):
    grid = torch.arange(0.5, 3.0001, 0.05)
    nll = torch.stack([F.cross_entropy(logits / t, labels) for t in grid])
    return round(grid[nll.argmin()].item(), 2)


def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()


def field_nll(t, items, labels):
    """Mean NLL of the app's combined scores. items[i] = crop groups, each a list of logit arrays."""
    nll = 0.0
    for groups, y in zip(items, labels):
        probs = [[softmax(z / t) for z in g] for g in groups]
        nll -= np.log(max(sc.combine_scores(probs)[y], 1e-12))
    return nll / len(items)


def fit_temperature_field(items, labels):
    grid = np.arange(0.5, 3.0001, 0.05)
    return round(float(grid[int(np.argmin([field_nll(t, items, labels) for t in grid]))]), 2)


def field_items(data: Path, pte: Path, n: int):
    """Logit groups for both app paths on fake val shots (photos never used in the test)."""
    import field_eval as fe
    latin = [s["latin"] for s in load_species(data)]  # the class order of every model trained on data
    shots, area = fe.make_shots(data, latin, n, split="val", backgrounds="train")
    m = fe.load_method(pte)
    items, ys, conds = [], [], []
    for cond, label, shot, tap in shots:
        tiles = fe.crop_logits(m, shot, sc.tile_rects(fe.CANVAS, area))
        centred = fe.crop_logits(m, shot, sc.crop_rects(fe.CANVAS, area))
        tapped = fe.crop_logits(m, shot, sc.tap_rects(fe.CANVAS, *tap))
        for path, groups in (("auto", [tiles] + [[c] for c in centred]), ("tap", [tapped])):
            items.append(groups)
            ys.append(label)
            conds.append(f"{cond}/{path}")
    return items, ys, conds


@torch.no_grad()
def main():
    ap = argparse.ArgumentParser()
    for a in ("--data", "--ckpt", "--out"):
        ap.add_argument(a, type=Path, required=True)
    ap.add_argument("--arch", required=True)
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--field-pte", type=Path, help="fit on fake val shots through the app's crop search")
    ap.add_argument("--field-n", type=int, default=300, help="species (2 shots each) for --field-pte")
    args = ap.parse_args()
    if args.field_pte:
        items, ys, conds = field_items(args.data, args.field_pte, args.field_n)
        t = fit_temperature_field(items, ys)
        rep = {"temperature": t, "fit_on": f"field shots, val photos, {len(items)} predictions",
               "nll_before": field_nll(1.0, items, ys), "nll_after": field_nll(t, items, ys),
               "per_path_best_t": {c: fit_temperature_field([i for i, k in zip(items, conds) if k == c],
                                                            [y for y, k in zip(ys, conds) if k == c])
                                   for c in sorted(set(conds))}}
        args.out.write_text(json.dumps(rep, indent=1))
        print(rep)
        return
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
