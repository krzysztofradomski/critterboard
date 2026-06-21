"""
STEP 2: Train on 20-Species Mini Dataset (M2 MacBook)
=====================================================
Fine-tunes EfficientNetV2-S on your downloaded insect images.
Uses Apple MPS backend for GPU acceleration on M2.

Typical runtime on M2 16GB:
  - 20 species × 150 images × 20 epochs ≈ 25-40 minutes

Usage:
    python 02_train.py
"""

import json
import os
import time
from pathlib import Path
from collections import defaultdict, Counter

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torchvision import transforms
from PIL import Image, UnidentifiedImageError

# ── Try importing timm; guide user if missing ───────────────────────────────
try:
    import timm
except ImportError:
    print("Missing dependency. Run:")
    print("  pip install timm torch torchvision tqdm")
    raise SystemExit(1)

from tqdm import tqdm

# ── Config ──────────────────────────────────────────────────────────────────
DATA_DIR        = Path("./data/images")
META_DIR        = Path("./data/meta")
CHECKPOINT_DIR  = Path("./checkpoints")
CHECKPOINT_DIR.mkdir(exist_ok=True)

CFG = {
    # The bare timm arch "efficientnetv2_s" has NO published pretrained weights
    # (create_model(pretrained=True) raises). The downloadable ImageNet weights
    # live under the tf_ port; .in21k_ft_in1k (ImageNet-21k → 1k) gives the
    # strongest transfer features for fine-grained, look-alike species.
    "model_name":       os.environ.get("CB_MODEL_NAME", "tf_efficientnetv2_s.in21k_ft_in1k"),
    # CB_* env vars allow the training-ui dashboard to pass config without
    # editing this file. All have sensible defaults so CLI usage is unchanged.
    "image_size":       int(os.environ.get("CB_IMAGE_SIZE",    "224")),
    "batch_size":       int(os.environ.get("CB_BATCH_SIZE",    "32")),   # safe for 16GB unified memory
    "epochs":           int(os.environ.get("CB_EPOCHS",        "20")),
    "warmup_epochs":    int(os.environ.get("CB_WARMUP_EPOCHS", "3")),
    "lr":               float(os.environ.get("CB_LR",          "3e-4")),
    "weight_decay":     1e-4,
    "label_smoothing":  0.1,
    "train_frac":       0.75,
    "val_frac":         0.15,
    # test_frac = remaining 0.10
    "num_workers":      0,         # 0 is safer on macOS MPS
    "min_images":       int(os.environ.get("CB_MIN_IMAGES",    "30")),   # skip species below this threshold
}

# ── Device ───────────────────────────────────────────────────────────────────
def get_device():
    if torch.backends.mps.is_available():
        print("✓ Using Apple MPS (M2 GPU)")
        return torch.device("mps")
    elif torch.cuda.is_available():
        print(f"✓ Using CUDA: {torch.cuda.get_device_name(0)}")
        return torch.device("cuda")
    else:
        print("⚠ Using CPU (will be slow)")
        return torch.device("cpu")

# ── Transforms ───────────────────────────────────────────────────────────────
MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]

def make_transforms(image_size: int, mode: str):
    if mode == "train":
        return transforms.Compose([
            transforms.RandomResizedCrop(image_size, scale=(0.55, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(0.3, 0.3, 0.2, 0.05),
            transforms.RandomRotation(25),
            transforms.RandomApply([transforms.GaussianBlur(3)], p=0.2),
            # Simulate phone camera: random perspective
            transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
            transforms.ToTensor(),
            transforms.Normalize(MEAN, STD),
        ])
    else:
        return transforms.Compose([
            transforms.Resize(int(image_size * 1.14)),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(MEAN, STD),
        ])

# ── Dataset ──────────────────────────────────────────────────────────────────
class InsectDataset(Dataset):
    def __init__(self, samples: list, transform):
        self.samples   = samples    # [(path, label_idx), ...]
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert("RGB")
        except (UnidentifiedImageError, OSError):
            # Corrupt file — return a blank image so training continues
            img = Image.new("RGB", (224, 224), (128, 128, 128))
        return self.transform(img), label


def build_splits(data_dir: Path, cfg: dict):
    """
    Scans data_dir/taxon_id/ folders, splits per-class
    to avoid data leakage, returns (train, val, test, class_names).
    """
    class_dirs = sorted([d for d in data_dir.iterdir() if d.is_dir()])

    # Load manifest for readable names
    manifest_path = META_DIR / "species_manifest.json"
    id_to_name = {}
    if manifest_path.exists():
        manifest = json.load(open(manifest_path))
        id_to_name = {str(m["taxon_id"]): m["scientific_name"] for m in manifest}

    class_names = []
    all_splits  = [[], [], []]   # train, val, test

    for label_idx, class_dir in enumerate(class_dirs):
        images = [
            p for p in class_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        if len(images) < cfg["min_images"]:
            continue

        name = id_to_name.get(class_dir.name, class_dir.name)
        class_names.append(name)
        label = len(class_names) - 1

        images = sorted(images)   # deterministic order
        n      = len(images)
        t_end  = int(n * cfg["train_frac"])
        v_end  = t_end + int(n * cfg["val_frac"])

        all_splits[0].extend([(p, label) for p in images[:t_end]])
        all_splits[1].extend([(p, label) for p in images[t_end:v_end]])
        all_splits[2].extend([(p, label) for p in images[v_end:]])

    print(f"\nClasses loaded: {len(class_names)}")
    for split_name, split in zip(["Train", "Val", "Test"], all_splits):
        print(f"  {split_name}: {len(split)} images")

    return all_splits[0], all_splits[1], all_splits[2], class_names


def build_loaders(cfg: dict):
    train_s, val_s, test_s, class_names = build_splits(DATA_DIR, cfg)
    sz = cfg["image_size"]

    train_ds = InsectDataset(train_s, make_transforms(sz, "train"))
    val_ds   = InsectDataset(val_s,   make_transforms(sz, "val"))
    test_ds  = InsectDataset(test_s,  make_transforms(sz, "test"))

    # Weighted sampler → balances unequal class sizes during training
    labels  = [s[1] for s in train_s]
    counts  = Counter(labels)
    weights = [1.0 / counts[l] for l in labels]
    sampler = WeightedRandomSampler(weights, len(weights), replacement=True)

    kw = dict(batch_size=cfg["batch_size"],
              num_workers=cfg["num_workers"],
              pin_memory=False)   # pin_memory not supported on MPS

    train_loader = DataLoader(train_ds, sampler=sampler, **kw)
    val_loader   = DataLoader(val_ds,   shuffle=False,   **kw)
    test_loader  = DataLoader(test_ds,  shuffle=False,   **kw)

    return train_loader, val_loader, test_loader, class_names

# ── Training helpers ──────────────────────────────────────────────────────────
def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = correct = total = 0

    for imgs, labels in tqdm(loader, desc="  train", leave=False):
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        logits = model(imgs)
        loss   = criterion(logits, labels)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        total_loss += loss.item() * imgs.size(0)
        correct    += (logits.argmax(1) == labels).sum().item()
        total      += imgs.size(0)

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = total = 0
    correct = {1: 0, 3: 0, 5: 0}
    k_max = min(5, len(loader.dataset.samples))  # can't ask top-5 if <5 classes

    for imgs, labels in tqdm(loader, desc="  eval ", leave=False):
        imgs, labels = imgs.to(device), labels.to(device)
        logits = model(imgs)
        total_loss += criterion(logits, labels).item() * imgs.size(0)
        total      += imgs.size(0)

        for k in [1, 3, 5]:
            if k <= logits.size(1):
                topk = logits.topk(k, dim=1).indices
                correct[k] += (topk == labels.unsqueeze(1)).any(1).sum().item()

    return {
        "loss":     total_loss / total,
        "top1_acc": correct[1] / total,
        "top3_acc": correct[3] / total,
        "top5_acc": correct[5] / total,
    }

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    device = get_device()

    train_loader, val_loader, test_loader, class_names = build_loaders(CFG)
    num_classes = len(class_names)
    print(f"\nModel: {CFG['model_name']}  |  Classes: {num_classes}")

    # Save class mapping for inference
    class_map = {i: name for i, name in enumerate(class_names)}
    with open(CHECKPOINT_DIR / "class_map.json", "w") as f:
        json.dump(class_map, f, indent=2)

    # Build model
    model = timm.create_model(
        CFG["model_name"],
        pretrained=True,
        num_classes=num_classes,
        drop_rate=0.3,
        drop_path_rate=0.2,
    ).to(device)

    criterion = nn.CrossEntropyLoss(label_smoothing=CFG["label_smoothing"])

    # ── Phase 1: warm up head only ─────────────────────────────────────────
    print(f"\n{'─'*55}")
    print(f"Phase 1: Warming up classifier head ({CFG['warmup_epochs']} epochs)")
    print(f"{'─'*55}")

    for p in model.parameters():
        p.requires_grad_(False)
    for p in model.classifier.parameters():
        p.requires_grad_(True)

    opt1  = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=1e-3, weight_decay=CFG["weight_decay"]
    )
    sched1 = torch.optim.lr_scheduler.CosineAnnealingLR(
        opt1, T_max=CFG["warmup_epochs"]
    )

    for epoch in range(1, CFG["warmup_epochs"] + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_epoch(model, train_loader, opt1, criterion, device)
        val_m = evaluate(model, val_loader, criterion, device)
        sched1.step()
        elapsed = time.time() - t0
        print(
            f"  Ep {epoch:02d} | "
            f"loss {tr_loss:.4f} | train {tr_acc:.3f} | "
            f"val top1 {val_m['top1_acc']:.3f} | "
            f"val top3 {val_m['top3_acc']:.3f} | "
            f"{elapsed:.0f}s"
        )

    # ── Phase 2: fine-tune full network ────────────────────────────────────
    remaining = CFG["epochs"] - CFG["warmup_epochs"]
    print(f"\n{'─'*55}")
    print(f"Phase 2: Full fine-tune ({remaining} epochs)")
    print(f"{'─'*55}")

    for p in model.parameters():
        p.requires_grad_(True)

    opt2   = torch.optim.AdamW(
        model.parameters(), lr=CFG["lr"], weight_decay=CFG["weight_decay"]
    )
    sched2 = torch.optim.lr_scheduler.CosineAnnealingLR(
        opt2, T_max=remaining, eta_min=1e-6
    )

    best_val  = 0.0
    history   = []

    for epoch in range(CFG["warmup_epochs"] + 1, CFG["epochs"] + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_epoch(model, train_loader, opt2, criterion, device)
        val_m = evaluate(model, val_loader, criterion, device)
        sched2.step()
        elapsed = time.time() - t0

        history.append({
            "epoch": epoch, "train_loss": tr_loss,
            "train_acc": tr_acc, **val_m
        })

        marker = ""
        if val_m["top1_acc"] > best_val:
            best_val = val_m["top1_acc"]
            torch.save({
                "epoch":       epoch,
                "model_state": model.state_dict(),
                "model_name":  CFG["model_name"],
                "num_classes": num_classes,
                "val_top1":    best_val,
                "class_map":   class_map,
            }, CHECKPOINT_DIR / "best_model.pth")
            marker = " ← best"

        print(
            f"  Ep {epoch:02d} | "
            f"loss {tr_loss:.4f} | train {tr_acc:.3f} | "
            f"val top1 {val_m['top1_acc']:.3f} | "
            f"val top3 {val_m['top3_acc']:.3f} | "
            f"{elapsed:.0f}s{marker}"
        )

    # Save history
    with open(CHECKPOINT_DIR / "history.json", "w") as f:
        json.dump(history, f, indent=2)

    # ── Final test evaluation ──────────────────────────────────────────────
    print(f"\n{'─'*55}")
    print("Final Test Evaluation")
    print(f"{'─'*55}")
    ckpt = torch.load(CHECKPOINT_DIR / "best_model.pth", map_location=device)
    model.load_state_dict(ckpt["model_state"])
    test_m = evaluate(model, test_loader, criterion, device)
    print(
        f"  Test top1: {test_m['top1_acc']:.3f} | "
        f"top3: {test_m['top3_acc']:.3f} | "
        f"top5: {test_m['top5_acc']:.3f}"
    )
    print(f"\nBest model saved to: {CHECKPOINT_DIR / 'best_model.pth'}")
    print("Next step: python 03_inference_test.py")


if __name__ == "__main__":
    main()
