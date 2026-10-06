"""Fine-tune a timm backbone on the sampled iNaturalist photos (CPU friendly).

- Weights come from timm's GitHub release assets (Hugging Face may be blocked):
  pass --weights /path/to/file.pth.
- Runs on CUDA, Apple GPUs (MPS) or CPU (--device, default auto). bf16 autocast on
  CPU/CUDA (fast on AMX / AVX512-BF16 hardware); fp32 on MPS.
- Progressive resizing: early epochs at a lower resolution, last ones at --size.
- Eval squashes the whole photo to size×size, exactly like the app
  (react-native-executorch resizes the frame to the model input, no crop).

Usage:
  python train.py --data /path/to/vdata --arch efficientnet_b0 \\
      --weights efficientnet_b0_ra-3dd342df.pth --epochs 12 --out runs/b0
"""

import argparse
import contextlib
import csv
import json
import math
import os
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


def pick_device(name: str = "auto") -> torch.device:
    """auto = CUDA if present, else an Apple-silicon GPU (MPS), else CPU."""
    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def autocast(device: torch.device):
    """bf16 autocast on CPU/CUDA, as eu-1k-commercial-v1 was trained. MPS runs fp32:
    mixed precision there would need a gradient scaler and is untested here."""
    if device.type in ("cpu", "cuda"):
        return torch.autocast(device.type, dtype=torch.bfloat16)
    return contextlib.nullcontext()


def cpu_state(model):
    """state_dict as CPU tensors, so checkpoints load on any machine."""
    return {k: v.detach().cpu() for k, v in model.state_dict().items()}


def load_species(data: Path):
    with (data / "species.csv").open() as f:
        rows = list(csv.DictReader(f))
    return rows


def head_row_map(old_latin, new_latin):
    """(new_row, old_row) for every species in both label lists, matched by Latin name."""
    old = {name: i for i, name in enumerate(old_latin)}
    return [(i, old[name]) for i, name in enumerate(new_latin) if name in old]


@torch.no_grad()
def copy_head_rows(new_w, new_b, old_w, old_b, pairs):
    """Copy classifier rows in place: carried-over species keep their old row."""
    for new_i, old_i in pairs:
        new_w[new_i] = old_w[old_i]
        new_b[new_i] = old_b[old_i]


def warm_start(model, ckpt: Path, labels_csv: Path, new_latin):
    """Load every weight from a previous checkpoint except the classifier, then copy
    the old classifier rows into the new one by Latin name. New species keep their
    fresh initialisation. Returns (carried-over count, new-species count)."""
    state = torch.load(ckpt, map_location="cpu", weights_only=True)
    cls = model.pretrained_cfg.get("classifier", "head")
    old_w, old_b = state.pop(f"{cls}.weight"), state.pop(f"{cls}.bias")
    missing, unexpected = model.load_state_dict(state, strict=False)
    assert not unexpected and set(missing) == {f"{cls}.weight", f"{cls}.bias"}, (missing, unexpected)
    with labels_csv.open() as f:
        old_latin = [r["latin"] for r in sorted(csv.DictReader(f), key=lambda r: int(r["index"]))]
    assert len(old_latin) == old_w.shape[0], "labels.csv does not match the checkpoint's classifier"
    pairs = head_row_map(old_latin, new_latin)
    head = model.get_classifier()
    copy_head_rows(head.weight, head.bias, old_w, old_b, pairs)
    return len(pairs), len(new_latin) - len(pairs)


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
def evaluate(model, loader, device=torch.device("cpu")):
    model.eval()
    top1 = top3 = n = 0
    per_class = {}
    for x, y in loader:
        with autocast(device):
            logits = model(x.to(device).contiguous(memory_format=torch.channels_last))
        pred = logits.float().topk(3, dim=1).indices.cpu()
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
    ap.add_argument("--device", default="auto", help="auto (cuda > mps > cpu), cuda, mps or cpu")
    ap.add_argument("--limit-steps", type=int, default=0, help="benchmark: stop after N steps")
    ap.add_argument("--max-per-class", type=int, default=0, help="pilot runs: cap train images per class")
    ap.add_argument("--drop-path", type=float, default=0.0, help="stochastic depth rate")
    ap.add_argument("--ckpt-every", type=int, default=400,
                    help="save a resumable checkpoint (out/last.pth) every N steps")
    ap.add_argument("--init", type=Path,
                    help="warm start: a previous run's best.pth (state_dict). Everything but the "
                         "classifier is loaded; classifier rows are carried over by Latin name")
    ap.add_argument("--init-labels", type=Path,
                    help="labels.csv (index, taxon_id, latin) giving the class order of --init")
    args = ap.parse_args()
    if bool(args.init) != bool(args.init_labels):
        ap.error("--init and --init-labels go together")

    torch.set_num_threads(args.threads)
    torch.manual_seed(0)
    device = pick_device(args.device)
    print(f"device: {device}", flush=True)
    args.out.mkdir(parents=True, exist_ok=True)

    species = load_species(args.data)
    n_cls = len(species)

    # timm's loader handles .pth and ViT .npz files and replaces the classifier.
    extra = {"dynamic_img_size": True} if args.arch.startswith("vit_") else {}
    model = timm.create_model(
        args.arch, pretrained=True, num_classes=n_cls,
        pretrained_cfg_overlay=dict(file=str(args.weights)), drop_path_rate=args.drop_path, **extra,
    )
    # --weights still builds the model (and is the fallback base). Don't pass a previous
    # 1,000-class run as --weights: with the same class count timm keeps its head as is,
    # and the rows would point at the wrong species. Use --init for that.
    if args.init and not (args.out / "last.pth").exists():
        kept, fresh = warm_start(model, args.init, args.init_labels, [s["latin"] for s in species])
        print(f"warm start from {args.init}: {kept} classifier rows carried over, {fresh} new species",
              flush=True)
    model = model.to(memory_format=torch.channels_last).to(device)

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

    n_train = len(Photos(args.data, "train", species, None, args.max_per_class))
    steps_per_epoch = n_train // args.batch
    total_steps = args.epochs * steps_per_epoch
    warmup = steps_per_epoch // 2

    # Resume: the container running this can restart mid-run. Everything needed
    # to continue exactly (weights, optimiser, position in the epoch) is in last.pth.
    history, best, steps_done, start_epoch, start_step = [], 0.0, 0, 0, 0
    last = args.out / "last.pth"
    if last.exists():
        ck = torch.load(last, map_location="cpu", weights_only=False)
        model.load_state_dict(ck["model"])
        opt.load_state_dict(ck["opt"])
        history, best, steps_done = ck["history"], ck["best"], ck["steps_done"]
        start_epoch, start_step = ck["epoch"], ck["step_in_epoch"]
        print(f"resumed at epoch {start_epoch} step {start_step} (global {steps_done})", flush=True)

    def save_last(epoch, step_in_epoch):
        tmp = args.out / "last.pth.tmp"
        torch.save({"model": cpu_state(model), "opt": opt.state_dict(), "history": history,
                    "best": best, "steps_done": steps_done, "epoch": epoch,
                    "step_in_epoch": step_in_epoch}, tmp)
        os.replace(tmp, last)

    for epoch in range(start_epoch, args.epochs):
        # Progressive resizing: linearly from start-size to size over the first
        # 2/3 of training, then hold at full size (multiples of 32).
        frac = min(1.0, epoch / max(1, math.ceil(args.epochs * 2 / 3) - 1))
        size = int(round((args.start_size + frac * (args.size - args.start_size)) / 32) * 32)
        train = Photos(args.data, "train", species, train_tf(size), args.max_per_class)
        # Deterministic per-epoch order so a resumed epoch skips exactly the
        # batches it already trained on.
        order = torch.randperm(len(train), generator=torch.Generator().manual_seed(1000 + epoch))
        skip = start_step if epoch == start_epoch else 0
        loader = DataLoader(train, batch_size=args.batch, sampler=order[skip * args.batch:].tolist(),
                            drop_last=True, num_workers=args.workers)

        model.train()
        t0, seen, loss_sum = time.time(), 0, 0.0
        step_in_epoch = skip
        for x, y in loader:
            # warmup + cosine
            if steps_done < warmup:
                scale = (steps_done + 1) / warmup
            else:
                scale = 0.5 * (1 + math.cos(math.pi * (steps_done - warmup) / (total_steps - warmup)))
            for g, lr in zip(opt.param_groups, base_lrs):
                g["lr"] = lr * scale

            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with autocast(device):
                loss = loss_fn(model(x.contiguous(memory_format=torch.channels_last)), y)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()

            steps_done += 1
            step_in_epoch += 1
            seen += len(y)
            loss_sum += loss.item() * len(y)
            if steps_done % 50 == 0:
                print(f"  ep{epoch} step{steps_done}/{total_steps} size{size} loss {loss_sum/seen:.3f} "
                      f"{seen/(time.time()-t0):.1f} img/s", flush=True)
            if args.limit_steps and steps_done >= args.limit_steps:
                print(f"benchmark: {seen/(time.time()-t0):.1f} img/s at {size}px")
                return
            if step_in_epoch % args.ckpt_every == 0:
                save_last(epoch, step_in_epoch)

        top1, top3, _ = evaluate(model, val_loader, device)
        rec = {"epoch": epoch, "size": size, "loss": loss_sum / max(1, seen), "val_top1": top1,
               "val_top3": top3, "minutes": (time.time() - t0) / 60}
        history.append(rec)
        print(json.dumps(rec), flush=True)
        (args.out / "history.json").write_text(json.dumps(history, indent=1))
        if top1 >= best:
            best = top1
            torch.save(cpu_state(model), args.out / "best.pth")
        save_last(epoch + 1, 0)

    # Final: best checkpoint on the held-out test split.
    model.load_state_dict(torch.load(args.out / "best.pth", map_location="cpu"))
    test = Photos(args.data, "test", species, eval_tf(args.size))
    top1, top3, per_class = evaluate(model, DataLoader(test, batch_size=128, num_workers=args.workers), device)
    worst = sorted(per_class.items(), key=lambda kv: kv[1][0] / kv[1][1])[:15]
    report = {
        "arch": args.arch, "classes": n_cls, "size": args.size,
        "train_images": n_train, "val_images": len(val), "test_images": len(test),
        "test_top1": top1, "test_top3": top3, "best_val_top1": best,
        "worst_classes": [
            {"latin": species[c]["latin"], "top1": h / t, "n": t} for c, (h, t) in worst
        ],
    }
    (args.out / "report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
