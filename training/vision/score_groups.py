"""Test accuracy by species group for a retrained model (PyTorch, squashed like the app).

Groups: all species, carried over from a previous model (by Latin name), forced
species (species.csv forced=1, e.g. household_species.txt), and new species.
With --prev, the previous model is scored on the carried-over species of the same
test photos, so the comparison is like for like.

  python score_groups.py --data $DATA/commercial --ckpt runs/x/best.pth --size 256 \\
      --prev-ckpt eu1k/best.pth --prev-labels results/commercial-1k-v1/labels.csv \\
      --out runs/x/groups_256.json
"""

import argparse
import csv
import json
from pathlib import Path

import timm
import torch
from torch.utils.data import DataLoader

from train import Photos, autocast, eval_tf, load_species, pick_device


@torch.no_grad()
def predictions(model, loader, device=torch.device("cpu")):
    model.eval().to(device)
    top3, labels = [], []
    for x, y in loader:
        with autocast(device):
            logits = model(x.to(device))
        top3.append(logits.float().topk(3, dim=1).indices.cpu())
        labels.append(y)
    return torch.cat(top3), torch.cat(labels)


def scores(top3, y, mask):
    n = int(mask.sum())
    if n == 0:
        return {"n": 0}
    t, yy = top3[mask], y[mask]
    return {"n": n, "top1": (t[:, 0] == yy).float().mean().item(),
            "top3": (t == yy[:, None]).any(1).float().mean().item()}


def load(arch, ckpt, n_cls, size):
    model = timm.create_model(arch, num_classes=n_cls, img_size=size)
    state = torch.load(ckpt, map_location="cpu", weights_only=True)
    if state["pos_embed"].shape != model.pos_embed.shape:
        from timm.layers import resample_abs_pos_embed
        state["pos_embed"] = resample_abs_pos_embed(state["pos_embed"], new_size=model.patch_embed.grid_size,
                                                    num_prefix_tokens=model.num_prefix_tokens)
    model.load_state_dict(state)
    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--ckpt", type=Path, required=True)
    ap.add_argument("--arch", default="vit_small_patch16_224")
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--prev-ckpt", type=Path)
    ap.add_argument("--prev-labels", type=Path, help="labels.csv of the previous model")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--device", default="auto", help="auto (cuda > mps > cpu), cuda, mps or cpu")
    args = ap.parse_args()
    torch.set_num_threads(4)
    device = pick_device(args.device)

    species = load_species(args.data)
    latin = [s["latin"] for s in species]
    forced = torch.tensor([s.get("forced") == "1" for s in species])
    prev_latin = []
    if args.prev_labels:
        with args.prev_labels.open() as f:
            prev_latin = [r["latin"] for r in sorted(csv.DictReader(f), key=lambda r: int(r["index"]))]
    carried = torch.tensor([n in set(prev_latin) for n in latin])

    loader = DataLoader(Photos(args.data, "test", species, eval_tf(args.size)), batch_size=64, num_workers=2)
    top3, y = predictions(load(args.arch, args.ckpt, len(species), args.size), loader, device)
    report = {
        "size": args.size,
        "all": scores(top3, y, torch.ones_like(y, dtype=torch.bool)),
        "carried_over": scores(top3, y, carried[y]),
        "new": scores(top3, y, ~carried[y]),
        "forced": scores(top3, y, forced[y]),
        "forced_per_species": {
            latin[c]: scores(top3, y, y == c) for c in range(len(species)) if forced[c]
        },
    }

    if args.prev_ckpt and prev_latin:
        # Previous model on the carried-over species' test photos, labels mapped by name.
        prev_top3, _ = predictions(load(args.arch, args.prev_ckpt, len(prev_latin), args.size), loader, device)
        to_new = torch.tensor([latin.index(n) if n in latin else -1 for n in prev_latin])
        report["previous_on_carried_over"] = scores(to_new[prev_top3], y, carried[y])

    args.out.write_text(json.dumps(report, indent=1))
    print(json.dumps({k: v for k, v in report.items() if k != "forced_per_species"}, indent=1))


if __name__ == "__main__":
    main()
