"""
Lightweight insect classifier — CPU-friendly training.
========================================================
Downloads 40 images per class from iNaturalist and fine-tunes
a MobileNetV3-Small backbone (frozen) + linear head.

Suitable for cloud / CPU environments: ~10–20 min total.

Usage:
    python train_lite.py                      # download + train
    python train_lite.py --no-download        # skip download, use existing data
    python train_lite.py --images 60          # 60 images per class
    python train_lite.py --epochs 40          # more training passes
    python train_lite.py --batch-size 16      # smaller batches for low RAM
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR    = Path(__file__).resolve().parent
DATA_DIR      = SCRIPT_DIR / "data" / "images"
META_DIR      = SCRIPT_DIR / "data" / "meta"
CKPT_DIR      = SCRIPT_DIR / "checkpoints"
CKPT_DIR.mkdir(parents=True, exist_ok=True)

INAT_API_BASE = "https://api.inaturalist.org/v1"
USER_AGENT    = "Critterboard-TrainLite/1.0 (educational; contact via github.com/critterboard)"

# ── Species list ───────────────────────────────────────────────────────────────
# 20 common, visually distinct Central European insects.
# taxon_id values from iNaturalist; duplicates removed.
TARGET_SPECIES = [
    (47219,  "Seven-spot Ladybird",    "Coccinella septempunctata"),
    (48484,  "Western Honey Bee",      "Apis mellifera"),
    (52747,  "Common Brimstone",       "Gonepteryx rhamni"),
    (52775,  "Buff-tailed Bumblebee",  "Bombus terrestris"),
    (57593,  "Peacock Butterfly",      "Aglais io"),
    (55626,  "Large White Butterfly",  "Pieris brassicae"),
    (57508,  "Red Admiral",            "Vanessa atalanta"),
    (57583,  "Small Tortoiseshell",    "Aglais urticae"),
    (57423,  "Small White Butterfly",  "Pieris rapae"),
    (48735,  "Common Wasp",            "Vespula vulgaris"),
    (61585,  "Stag Beetle",            "Lucanus cervus"),
    (119870, "Green Shield Bug",       "Palomena prasina"),
    (56057,  "Common Blue Damselfly",  "Enallagma cyathigerum"),
    (61525,  "Rose Chafer",            "Cetonia aurata"),
    (52798,  "Orange Tip",             "Anthocharis cardamines"),
    (57486,  "Painted Lady",           "Vanessa cardui"),
    (48745,  "European Hornet",        "Vespa crabro"),
    (52786,  "Common Swallowtail",     "Papilio machaon"),
    (60827,  "Harlequin Ladybird",     "Harmonia axyridis"),
    (48480,  "Garden Bumblebee",       "Bombus hortorum"),
]

# Remove any accidental duplicates by taxon_id
_seen: set = set()
UNIQUE_SPECIES = []
for item in TARGET_SPECIES:
    if item[0] not in _seen:
        _seen.add(item[0])
        UNIQUE_SPECIES.append(item)


# ════════════════════════════════════════════════════════════════════════════════
# DOWNLOAD UTILITIES
# ════════════════════════════════════════════════════════════════════════════════

def _fetch_json(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception as exc:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def _fetch_photo_urls(taxon_id: int, limit: int) -> list[dict]:
    """Return up to `limit` medium-size photo URLs for a taxon (Europe only)."""
    photos: list[dict] = []
    page, per_page = 1, min(100, limit + 10)

    while len(photos) < limit:
        url = (
            f"{INAT_API_BASE}/observations"
            f"?taxon_id={taxon_id}"
            f"&quality_grade=research"
            f"&photos=true"
            f"&nelat=71&nelng=45&swlat=34&swlng=-25"
            f"&per_page={per_page}&page={page}"
            f"&order_by=votes"
        )
        try:
            data = _fetch_json(url)
        except Exception as exc:
            print(f"    API error (taxon {taxon_id}): {exc}")
            break

        results = data.get("results", [])
        if not results:
            break

        for obs in results:
            for photo in obs.get("photos", []):
                photo_url = photo.get("url", "").replace("square", "medium")
                if photo_url:
                    photos.append({"photo_id": photo["id"], "url": photo_url})
                    if len(photos) >= limit:
                        break
            if len(photos) >= limit:
                break

        if len(results) < per_page:
            break
        page += 1
        time.sleep(0.4)

    return photos[:limit]


def _download_one(args: tuple) -> tuple[bool, str]:
    url, dest_path = args
    if dest_path.exists() and dest_path.stat().st_size > 1000:
        return True, str(dest_path)
    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read()
        if len(data) < 500:
            return False, f"Too small: {url}"
        dest_path.write_bytes(data)
        return True, str(dest_path)
    except Exception as exc:
        return False, f"{url}: {exc}"


def download_dataset(images_per_class: int, max_workers: int = 8) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)

    manifest = [
        {"taxon_id": t, "common_name": c, "scientific_name": s}
        for t, c, s in UNIQUE_SPECIES
    ]
    (META_DIR / "species_manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"\nDownloading {len(UNIQUE_SPECIES)} species × ~{images_per_class} images")
    print(f"Output: {DATA_DIR}\n")

    total_ok = total_fail = 0

    for taxon_id, common_name, sci_name in UNIQUE_SPECIES:
        species_dir = DATA_DIR / str(taxon_id)
        species_dir.mkdir(exist_ok=True)

        existing = [
            p for p in species_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
            and p.stat().st_size > 1000
        ]
        if len(existing) >= images_per_class:
            print(f"  [{common_name}] {len(existing)} images already present — skipping.")
            continue

        need = images_per_class - len(existing)
        print(f"  [{common_name}] Fetching list for {need} more images…", end=" ", flush=True)

        try:
            photos = _fetch_photo_urls(taxon_id, need + 10)
        except Exception as exc:
            print(f"FAILED ({exc})")
            continue

        print(f"{len(photos)} available")

        tasks = []
        for photo in photos:
            ext = photo["url"].split(".")[-1].split("?")[0] or "jpg"
            dest = species_dir / f"{photo['photo_id']}.{ext}"
            if not (dest.exists() and dest.stat().st_size > 1000):
                tasks.append((photo["url"], dest))

        ok = fail = 0
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {pool.submit(_download_one, t): t for t in tasks}
            for fut in as_completed(futures):
                success, _ = fut.result()
                if success:
                    ok += 1
                else:
                    fail += 1

        # Trim to exact target
        all_files = sorted(
            p for p in species_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
            and p.stat().st_size > 1000
        )
        for extra in all_files[images_per_class:]:
            extra.unlink()

        actual = len([
            p for p in species_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ])
        total_ok   += ok
        total_fail += fail
        print(f"    ✓ {actual} images  ({fail} failed downloads)")

    total_images = sum(
        len(list((DATA_DIR / str(tid)).iterdir()))
        for tid, *_ in UNIQUE_SPECIES
        if (DATA_DIR / str(tid)).exists()
    )
    print(f"\nDataset ready: {total_images} total images across {len(UNIQUE_SPECIES)} classes.")


# ════════════════════════════════════════════════════════════════════════════════
# TRAINING
# ════════════════════════════════════════════════════════════════════════════════

def train(epochs: int, batch_size: int, lr: float, min_images: int) -> None:
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
        import torchvision.models as models
        import torchvision.transforms as T
        from PIL import Image, UnidentifiedImageError
    except ImportError as exc:
        print(f"Missing dependency: {exc}")
        print("Run: pip install torch torchvision Pillow")
        sys.exit(1)

    # ── Device ────────────────────────────────────────────────────────────────
    if torch.backends.mps.is_available():
        device = torch.device("mps")
        print("✓ Using Apple MPS")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"✓ Using CUDA: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("⚠ CPU only — expect ~10–20 min for feature extraction + training")

    # ── Load class list ───────────────────────────────────────────────────────
    manifest_path = META_DIR / "species_manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        id_to_sci = {str(m["taxon_id"]): m["scientific_name"] for m in manifest}
    else:
        id_to_sci = {}

    class_dirs = sorted(
        d for d in DATA_DIR.iterdir()
        if d.is_dir() and
        len([p for p in d.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]) >= min_images
    )

    if not class_dirs:
        print(f"No class directories with ≥ {min_images} images found in {DATA_DIR}")
        print("Run the download step first.")
        sys.exit(1)

    class_names = [id_to_sci.get(d.name, d.name) for d in class_dirs]
    num_classes  = len(class_names)
    print(f"\n{num_classes} classes found.")

    # Save class map
    class_map = {str(i): name for i, name in enumerate(class_names)}
    (CKPT_DIR / "class_map_lite.json").write_text(json.dumps(class_map, indent=2))
    print(f"Class map saved → {CKPT_DIR / 'class_map_lite.json'}")

    # ── Transforms ────────────────────────────────────────────────────────────
    MEAN = [0.485, 0.456, 0.406]
    STD  = [0.229, 0.224, 0.225]

    train_tf = T.Compose([
        T.RandomResizedCrop(224, scale=(0.5, 1.0)),
        T.RandomHorizontalFlip(),
        T.ColorJitter(0.3, 0.3, 0.2, 0.05),
        T.RandomRotation(20),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
    ])
    val_tf = T.Compose([
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(MEAN, STD),
    ])

    # ── Dataset ────────────────────────────────────────────────────────────────
    class InsectDataset(Dataset):
        def __init__(self, samples: list, transform):
            self.samples   = samples
            self.transform = transform

        def __len__(self):
            return len(self.samples)

        def __getitem__(self, idx: int):
            path, label = self.samples[idx]
            try:
                img = Image.open(path).convert("RGB")
            except (UnidentifiedImageError, OSError):
                img = Image.new("RGB", (224, 224), (128, 128, 128))
            return self.transform(img), label

    # Build samples with per-class train/val split
    train_samples: list = []
    val_samples:   list = []
    for label_idx, class_dir in enumerate(class_dirs):
        images = sorted(
            p for p in class_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        )
        if len(images) < min_images:
            continue
        split = max(1, int(len(images) * 0.8))
        train_samples.extend([(p, label_idx) for p in images[:split]])
        val_samples.extend([(p, label_idx) for p in images[split:]])

    print(f"Train: {len(train_samples)} images | Val: {len(val_samples)} images")

    from collections import Counter
    label_counts = Counter(s[1] for s in train_samples)
    weights      = [1.0 / label_counts[s[1]] for s in train_samples]
    sampler      = WeightedRandomSampler(weights, len(weights), replacement=True)

    train_loader = DataLoader(
        InsectDataset(train_samples, train_tf),
        batch_size=batch_size, sampler=sampler, num_workers=0,
    )
    val_loader = DataLoader(
        InsectDataset(val_samples, val_tf),
        batch_size=batch_size, shuffle=False, num_workers=0,
    )

    # ── Model: MobileNetV3-Small ───────────────────────────────────────────────
    # Try to load ImageNet pre-trained weights; fall back to random init
    # if the download URL is unreachable (e.g. restricted cloud environments).
    print(f"\nLoading MobileNetV3-Small…")
    try:
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        print("  ✓ ImageNet weights loaded (feature extraction mode)")
        pretrained = True
    except Exception:
        model = models.mobilenet_v3_small(weights=None)
        print("  ⚠ Pretrained weights unavailable — using random initialisation")
        print("    (full fine-tuning will be used instead of feature extraction)")
        pretrained = False

    # Freeze the feature extractor only when we have good pretrained features
    for param in model.features.parameters():
        param.requires_grad_(not pretrained or False)  # freeze if pretrained

    # Replace the classifier head with our target number of classes
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    # Only the new head (and the AdaptiveAvgPool) trains

    model = model.to(device)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params     = sum(p.numel() for p in model.parameters())
    print(f"Trainable params: {trainable_params:,} / {total_params:,} "
          f"({trainable_params / total_params:.1%})")

    # When training from random init (no pretrained weights), train all layers
    if not pretrained:
        for param in model.parameters():
            param.requires_grad_(True)

    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()), lr=lr
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = nn.CrossEntropyLoss()

    # ── Training loop ──────────────────────────────────────────────────────────
    print(f"\nTraining {epochs} epochs (batch={batch_size}, lr={lr:.0e})")
    print(f"{'─'*62}")
    print(f"{'Epoch':>5}  {'Train acc':>9}  {'Val top-1':>9}  {'Val top-3':>9}  {'Time':>6}")
    print(f"{'─'*62}")

    best_val_top1 = 0.0
    history: list[dict] = []

    for epoch in range(1, epochs + 1):
        t0 = time.time()

        # Train
        model.train()
        correct = total = 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(imgs)
            loss   = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            correct += (logits.argmax(1) == labels).sum().item()
            total   += len(labels)
        train_acc = correct / total if total else 0.0

        # Validate
        model.eval()
        correct1 = correct3 = val_total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                logits = model(imgs)
                correct1 += (logits.argmax(1) == labels).sum().item()
                if num_classes >= 3:
                    top3 = logits.topk(3, dim=1).indices
                    correct3 += (top3 == labels.unsqueeze(1)).any(1).sum().item()
                val_total += len(labels)

        val_top1 = correct1 / val_total if val_total else 0.0
        val_top3 = correct3 / val_total if val_total else 0.0
        elapsed  = time.time() - t0
        scheduler.step()

        marker = ""
        if val_top1 > best_val_top1:
            best_val_top1 = val_top1
            torch.save({
                "epoch":       epoch,
                "model_state": model.state_dict(),
                "model_arch":  "mobilenet_v3_small",
                "num_classes": num_classes,
                "val_top1":    best_val_top1,
                "class_map":   class_map,
            }, CKPT_DIR / "best_model_lite.pth")
            marker = " ★"

        record = {
            "epoch": epoch, "train_acc": train_acc,
            "top1_acc": val_top1, "top3_acc": val_top3,
        }
        history.append(record)
        print(
            f"{epoch:>5}  {train_acc:>9.3f}  {val_top1:>9.3f}  "
            f"{val_top3:>9.3f}  {elapsed:>5.0f}s{marker}"
        )

    (CKPT_DIR / "history_lite.json").write_text(json.dumps(history, indent=2))

    print(f"\n{'─'*62}")
    print(f"Best validation top-1: {best_val_top1:.1%}")
    print(f"Checkpoint → {CKPT_DIR / 'best_model_lite.pth'}")
    print(f"Class map  → {CKPT_DIR / 'class_map_lite.json'}")
    print("\nNext: open the Streamlit dashboard → 🔍 Identify tab to test the model.")


# ════════════════════════════════════════════════════════════════════════════════
# CLI
# ════════════════════════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--no-download",  action="store_true",
                   help="Skip the download step (use existing data)")
    p.add_argument("--demo",         action="store_true",
                   help="Generate synthetic demo data instead of downloading "
                        "(useful in offline/restricted-network environments)")
    p.add_argument("--images",       type=int,   default=40,
                   help="Images per class to download or generate (default: 40)")
    p.add_argument("--epochs",       type=int,   default=30,
                   help="Training epochs (default: 30)")
    p.add_argument("--batch-size",   type=int,   default=32,
                   help="Batch size (default: 32)")
    p.add_argument("--lr",           type=float, default=1e-3,
                   help="Learning rate (default: 1e-3)")
    p.add_argument("--min-images",   type=int,   default=15,
                   help="Skip classes with fewer images (default: 15)")
    p.add_argument("--workers",      type=int,   default=8,
                   help="Parallel download workers (default: 8)")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    print("=" * 62)
    print("  Critterboard — Lightweight Insect Classifier")
    print("=" * 62)

    if args.demo:
        print("Demo mode: generating synthetic discriminative images…")
        # Import and run synthetic generator
        try:
            from generate_demo_data import generate_dataset
            generate_dataset(images_per_class=max(args.images, 50), img_size=224)
        except ImportError:
            print("ERROR: generate_demo_data.py not found alongside train_lite.py")
            sys.exit(1)
    elif not args.no_download:
        download_dataset(images_per_class=args.images, max_workers=args.workers)
    else:
        print("Skipping download (--no-download).")

    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        min_images=args.min_images,
    )


if __name__ == "__main__":
    main()
