"""
STEP 3: Test Inference on a Single Image
=========================================
Point this at any insect photo to verify your trained model works.

Usage:
    python 03_inference_test.py --image path/to/photo.jpg
    python 03_inference_test.py --image path/to/photo.jpg --top 5
    python 03_inference_test.py --demo   # runs on a random image from test set
"""

import sys
import json
import argparse
import random
from pathlib import Path

import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image

try:
    import timm
except ImportError:
    print("Run: pip install timm")
    raise SystemExit(1)

CHECKPOINT_DIR = Path("./checkpoints")
DATA_DIR       = Path("./data/images")
MEAN = [0.485, 0.456, 0.406]
STD  = [0.229, 0.224, 0.225]

def load_model(checkpoint_path: Path, device: torch.device):
    ckpt = torch.load(checkpoint_path, map_location=device)
    model = timm.create_model(
        ckpt["model_name"],
        pretrained=False,
        num_classes=ckpt["num_classes"]
    )
    model.load_state_dict(ckpt["model_state"])
    model.eval().to(device)
    return model, ckpt["class_map"]

def preprocess(image_path: Path, image_size: int = 224) -> torch.Tensor:
    transform = transforms.Compose([
        transforms.Resize(int(image_size * 1.14)),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    img = Image.open(image_path).convert("RGB")
    return transform(img).unsqueeze(0)   # add batch dim

@torch.no_grad()
def predict(model, tensor: torch.Tensor, class_map: dict,
            device: torch.device, top_k: int = 3):
    tensor = tensor.to(device)
    logits = model(tensor)
    probs  = F.softmax(logits, dim=1)[0]

    top = probs.topk(min(top_k, len(class_map)))
    results = []
    for prob, idx in zip(top.values.tolist(), top.indices.tolist()):
        results.append({
            "rank":       len(results) + 1,
            "species":    class_map[str(idx)],
            "confidence": prob,
        })
    return results

def get_demo_image() -> Path:
    """Pick a random image from the test portion of the dataset."""
    all_images = list(DATA_DIR.rglob("*.jpg")) + list(DATA_DIR.rglob("*.jpeg"))
    if not all_images:
        print("No images found in ./data/images — run 01_setup_and_download.py first")
        raise SystemExit(1)
    return random.choice(all_images)

def print_results(image_path: Path, results: list, true_label: str = None):
    print(f"\n{'─'*50}")
    print(f"Image: {image_path.name}")
    if true_label:
        print(f"True species: {true_label}")
    print(f"{'─'*50}")
    for r in results:
        bar = "█" * int(r["confidence"] * 30)
        print(f"  #{r['rank']}  {r['confidence']:.1%}  {bar}  {r['species']}")
    print()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=str, help="Path to insect image")
    parser.add_argument("--demo",  action="store_true",
                        help="Use a random image from the dataset")
    parser.add_argument("--top",   type=int, default=3,
                        help="Number of top predictions (default: 3)")
    args = parser.parse_args()

    if not args.image and not args.demo:
        parser.print_help()
        print("\nTip: use --demo to quickly test with a dataset image")
        raise SystemExit(0)

    checkpoint = CHECKPOINT_DIR / "best_model.pth"
    if not checkpoint.exists():
        print(f"No checkpoint found at {checkpoint}")
        print("Run 02_train.py first.")
        raise SystemExit(1)

    device = torch.device(
        "mps"  if torch.backends.mps.is_available() else
        "cuda" if torch.cuda.is_available() else "cpu"
    )
    print(f"Using device: {device}")

    model, class_map = load_model(checkpoint, device)
    print(f"Model loaded. Classes: {len(class_map)}")

    if args.demo:
        image_path = get_demo_image()
        # Try to infer true species from folder name
        taxon_id   = image_path.parent.name
        true_label = class_map.get(
            next((k for k, v in class_map.items()
                  if taxon_id in str(v)), None),
            taxon_id
        )
    else:
        image_path = Path(args.image)
        if not image_path.exists():
            print(f"File not found: {image_path}")
            raise SystemExit(1)
        true_label = None

    tensor  = preprocess(image_path)
    results = predict(model, tensor, class_map, device, top_k=args.top)
    print_results(image_path, results, true_label)

    # Simple accuracy check for demo mode
    if true_label and results:
        top1_correct = true_label in results[0]["species"]
        top3_correct = any(true_label in r["species"] for r in results[:3])
        print(f"Top-1 match: {'✓' if top1_correct else '✗'}")
        print(f"Top-3 match: {'✓' if top3_correct else '✗'}")

if __name__ == "__main__":
    main()
