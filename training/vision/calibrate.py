"""Fit one temperature on the val split so softmax confidence matches accuracy (Guo et al. 2017).

  python calibrate.py --data $DATA --arch vit_small_patch16_224 --ckpt runs/v7/best.pth \\
      --size 256 --out runs/v7/temperature.json

Then export with `export.py --temperature T`: the .pte returns logits / T, so the app's
softmax gives calibrated confidences with no app change.
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
