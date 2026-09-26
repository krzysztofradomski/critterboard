"""Fine-tune a timm backbone on the sampled iNaturalist photos (CPU friendly).

- Weights come from timm's GitHub release assets (Hugging Face may be blocked):
  pass --weights /path/to/file.pth.
- bf16 autocast on CPU (fast on AMX / AVX512-BF16 hardware).
- Progressive resizing: early epochs at a lower resolution, last ones at --size.
- Eval squashes the whole photo to size×size, exactly like the app
  (react-native-executorch resizes the frame to the model input, no crop).

Usage:
  python train.py --data /path/to/vdata --arch efficientnet_b0 \\
      --weights efficientnet_b0_ra-3dd342df.pth --epochs 12 --out runs/b0
"""

import argparse
import csv
import json
import math
import time
from pathlib import Path

import timm
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms as T

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


def load_species(data: Path):
    with (data / "species.csv").open() as f:
        rows = list(csv.DictReader(f))
    return rows


class Photos(Dataset):
    def __init__(self, data: Path, split: str, species, tf, max_per_class: int = 0):
        self.tf = tf
        idx = {r["taxon_id"]: i for i, r in enumerate(species)}
        root = data / "images" / split
        self.items = [
            (p, idx[d.name])
            for d in sorted(root.iterdir()) if d.name in idx
            for p in sorted(d.glob("*.jpg"))[: max_per_class or None]
        ]

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        return self.tf(Image.open(path).convert("RGB")), label


def train_tf(size):
    return T.Compose([
        T.RandomResizedCrop(size, scale=(0.3, 1.0), ratio=(0.6, 1.66)),
        T.RandomHorizontalFlip(),
        T.TrivialAugmentWide(),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
        T.RandomErasing(p=0.2),
    ])


def eval_tf(size):
    return T.Compose([T.Resize((size, size)), T.ToTensor(), T.Normalize(MEAN, STD)])


@torch.no_grad()
def evaluate(model, loader):
    model.eval()
    top1 = top3 = n = 0
    per_class = {}
    for x, y in loader:
        with torch.autocast("cpu", dtype=torch.bfloat16):
            logits = model(x.contiguous(memory_format=torch.channels_last))
        pred = logits.float().topk(3, dim=1).indices
        hit1 = pred[:, 0] == y
        top1 += hit1.sum().item()
        top3 += (pred == y[:, None]).any(1).sum().item()
        n += len(y)
        for yi, h in zip(y.tolist(), hit1.tolist()):
            c = per_class.setdefault(yi, [0, 0])
            c[0] += h
            c[1] += 1
    return top1 / n, top3 / n, per_class


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--arch", required=True)
    ap.add_argument("--weights", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--start-size", type=int, default=160)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--wd", type=float, default=0.05)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--limit-steps", type=int, default=0, help="benchmark: stop after N steps")
    ap.add_argument("--max-per-class", type=int, default=0, help="pilot runs: cap train images per class")
    ap.add_argument("--drop-path", type=float, default=0.0, help="stochastic depth rate")
    args = ap.parse_args()

    torch.set_num_threads(args.threads)
    torch.manual_seed(0)
    args.out.mkdir(parents=True, exist_ok=True)

    species = load_species(args.data)
    n_cls = len(species)

    # timm's loader handles .pth and ViT .npz files and replaces the classifier.
    extra = {"dynamic_img_size": True} if args.arch.startswith("vit_") else {}
    model = timm.create_model(
        args.arch, pretrained=True, num_classes=n_cls,
        pretrained_cfg_overlay=dict(file=str(args.weights)), drop_path_rate=args.drop_path, **extra,
    )
    model = model.to(memory_format=torch.channels_last)

    val = Photos(args.data, "val", species, eval_tf(args.size))
    val_loader = DataLoader(val, batch_size=128, num_workers=args.workers)

    head = model.get_classifier()
    head_params = {id(p) for p in head.parameters()}
    params = [
        {"params": [p for p in model.parameters() if id(p) not in head_params], "lr": args.lr * 0.5},
        {"params": list(head.parameters()), "lr": args.lr * 5},
    ]
    opt = torch.optim.AdamW(params, weight_decay=args.wd)
    base_lrs = [g["lr"] for g in opt.param_groups]
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)

    history, best = [], 0.0
    steps_done = 0
    total_steps = None
    for epoch in range(args.epochs):
        # Progressive resizing: linearly from start-size to size over the first
        # 2/3 of training, then hold at full size (multiples of 32).
        frac = min(1.0, epoch / max(1, math.ceil(args.epochs * 2 / 3) - 1))
        size = int(round((args.start_size + frac * (args.size - args.start_size)) / 32) * 32)
        train = Photos(args.data, "train", species, train_tf(size), args.max_per_class)
        loader = DataLoader(train, batch_size=args.batch, shuffle=True, drop_last=True,
                            num_workers=args.workers, persistent_workers=False)
        if total_steps is None:
            total_steps = args.epochs * len(loader)
            warmup = len(loader) // 2

        model.train()
        t0, seen, loss_sum = time.time(), 0, 0.0
        for x, y in loader:
            # warmup + cosine
            if steps_done < warmup:
                scale = (steps_done + 1) / warmup
            else:
                scale = 0.5 * (1 + math.cos(math.pi * (steps_done - warmup) / (total_steps - warmup)))
            for g, lr in zip(opt.param_groups, base_lrs):
                g["lr"] = lr * scale

            with torch.autocast("cpu", dtype=torch.bfloat16):
                loss = loss_fn(model(x.contiguous(memory_format=torch.channels_last)), y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()

            steps_done += 1
            seen += len(y)
            loss_sum += loss.item() * len(y)
            if steps_done % 50 == 0:
                print(f"  ep{epoch} step{steps_done} size{size} loss {loss_sum/seen:.3f} "
                      f"{seen/(time.time()-t0):.1f} img/s", flush=True)
            if args.limit_steps and steps_done >= args.limit_steps:
                print(f"benchmark: {seen/(time.time()-t0):.1f} img/s at {size}px")
                return

        top1, top3, _ = evaluate(model, val_loader)
        rec = {"epoch": epoch, "size": size, "loss": loss_sum / seen, "val_top1": top1,
               "val_top3": top3, "minutes": (time.time() - t0) / 60}
        history.append(rec)
        print(json.dumps(rec), flush=True)
        (args.out / "history.json").write_text(json.dumps(history, indent=1))
        if top1 >= best:
            best = top1
            torch.save(model.state_dict(), args.out / "best.pth")

    # Final: best checkpoint on the held-out test split.
    model.load_state_dict(torch.load(args.out / "best.pth", map_location="cpu"))
    test = Photos(args.data, "test", species, eval_tf(args.size))
    top1, top3, per_class = evaluate(model, DataLoader(test, batch_size=128, num_workers=args.workers))
    worst = sorted(per_class.items(), key=lambda kv: kv[1][0] / kv[1][1])[:15]
    report = {
        "arch": args.arch, "classes": n_cls, "size": args.size,
        "train_images": len(train), "val_images": len(val), "test_images": len(test),
        "test_top1": top1, "test_top3": top3, "best_val_top1": best,
        "worst_classes": [
            {"latin": species[c]["latin"], "top1": h / t, "n": t} for c, (h, t) in worst
        ],
    }
    (args.out / "report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
