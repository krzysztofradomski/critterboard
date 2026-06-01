"""
STEP 4: Export Model for Mobile Deployment
==========================================
Converts your trained PyTorch model to:
  - ExecuTorch .pte → react-native-executorch (primary mobile path)
  - ONNX            → Android / cross-platform fallback (ONNX Runtime)
  - CoreML          → iOS fallback (Vision framework / Neural Engine)

Supports both training pipelines:
  - train_lite.py  → best_model_lite.pth  (MobileNetV3-Small, torchvision)
  - train.py       → best_model.pth       (EfficientNetV2-S, timm)

Also writes:
  - assets/models/class_map.json
  - src/ai/classMap.ts  (TypeScript bridge: index/scientific → bug ID)

Usage:
    pip install onnx onnxruntime
    python 04_export.py          # ONNX + CoreML + classMap.ts
    python 04_export.py --pte    # also attempt ExecuTorch .pte export

ExecuTorch requires a separate install (Linux/Mac only):
    pip install executorch
    See: https://pytorch.org/executorch/stable/getting-started-setup.html
"""

import json
import sys
import shutil
import argparse
import torch
import torch.nn as nn
from pathlib import Path

REPO_ROOT      = Path(__file__).resolve().parents[2]
CHECKPOINT_DIR = Path(__file__).parent / "checkpoints"
ASSETS_DIR     = REPO_ROOT / "assets" / "models"
TS_CLASS_MAP   = REPO_ROOT / "src" / "ai" / "classMap.ts"
IMAGE_SIZE     = 224

# scientific name → 4-letter app bug ID (mirrors src/ai/classMap.ts)
SCIENTIFIC_TO_BUG_ID = {
    'Palomena prasina':          'gshb',
    'Coccinella septempunctata': 'lady',
    'Bombus hortorum':           'gbee',
    'Apis mellifera':            'hcat',
    'Vespula vulgaris':          'wasp',
    'Vespa crabro':              'horn',
    'Gonepteryx rhamni':         'brim',
    'Bombus terrestris':         'buff',
    'Papilio machaon':           'swal',
    'Anthocharis cardamines':    'orng',
    'Pieris brassicae':          'lwhi',
    'Enallagma cyathigerum':     'bdam',
    'Pieris rapae':              'swhi',
    'Vanessa cardui':            'pntl',
    'Vanessa atalanta':          'radm',
    'Aglais urticae':            'tort',
    'Aglais io':                 'peac',
    'Harmonia axyridis':         'harl',
    'Cetonia aurata':            'rchf',
    'Lucanus cervus':            'stag',
}

SPECIES_COMMENT = {
    'gshb': 'Palomena prasina',
    'lady': 'Coccinella septempunctata',
    'gbee': 'Bombus hortorum',
    'hcat': 'Apis mellifera',
    'wasp': 'Vespula vulgaris',
    'horn': 'Vespa crabro',
    'brim': 'Gonepteryx rhamni',
    'buff': 'Bombus terrestris',
    'swal': 'Papilio machaon',
    'orng': 'Anthocharis cardamines',
    'lwhi': 'Pieris brassicae',
    'bdam': 'Enallagma cyathigerum',
    'swhi': 'Pieris rapae',
    'pntl': 'Vanessa cardui',
    'radm': 'Vanessa atalanta',
    'tort': 'Aglais urticae',
    'peac': 'Aglais io',
    'harl': 'Harmonia axyridis',
    'rchf': 'Cetonia aurata',
    'stag': 'Lucanus cervus',
}


def pick_checkpoint(args):
    lite_path = CHECKPOINT_DIR / "best_model_lite.pth"
    full_path = CHECKPOINT_DIR / "best_model.pth"
    if args.lite:
        if not lite_path.exists():
            sys.exit(f"ERROR: {lite_path} not found. Run train_lite.py first.")
        return lite_path
    if args.full:
        if not full_path.exists():
            sys.exit(f"ERROR: {full_path} not found. Run train.py first.")
        return full_path
    # auto-detect: prefer lite
    if lite_path.exists():
        print(f"  Auto-selected lite checkpoint: {lite_path.name}")
        return lite_path
    if full_path.exists():
        print(f"  Auto-selected full checkpoint: {full_path.name}")
        return full_path
    sys.exit("ERROR: No checkpoint found. Run train_lite.py or train.py first.")


def load_model_mobilenet(ckpt):
    from torchvision import models
    num_classes = ckpt["num_classes"]
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, num_classes)
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    return model


def load_model_efficientnet(ckpt):
    try:
        import timm
    except ImportError:
        sys.exit("ERROR: pip install timm  (needed for EfficientNetV2-S checkpoints)")
    model = timm.create_model(
        ckpt["model_name"], pretrained=False, num_classes=ckpt["num_classes"]
    )
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    return model


def load_model(ckpt_path):
    ckpt = torch.load(ckpt_path, map_location="cpu")
    arch = ckpt.get("model_arch", "")
    if arch == "mobilenet_v3_small":
        print(f"  Architecture: MobileNetV3-Small ({ckpt['num_classes']} classes)")
        model = load_model_mobilenet(ckpt)
    else:
        print(f"  Architecture: EfficientNetV2-S ({ckpt['num_classes']} classes)")
        model = load_model_efficientnet(ckpt)
    return model, ckpt["class_map"], ckpt["num_classes"]


def export_onnx(model, dummy_input, out_dir):
    out_path = out_dir / "insect_classifier.onnx"
    torch.onnx.export(
        model,
        dummy_input,
        out_path,
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch_size"}},
        opset_version=17,
        do_constant_folding=True,
    )
    size_mb = out_path.stat().st_size / 1e6
    print(f"  ✓ ONNX: {out_path}  ({size_mb:.1f} MB)")

    try:
        import onnxruntime as ort
        import numpy as np
        sess = ort.InferenceSession(str(out_path))
        out  = sess.run(None, {"image": dummy_input.numpy()})
        print(f"    ONNX validation OK — output shape: {out[0].shape}")
    except ImportError:
        print("    (install onnxruntime to validate)")


def export_coreml(model, dummy_input, class_map, out_dir):
    try:
        import coremltools as ct
    except ImportError:
        print("  Skipping CoreML — pip install coremltools")
        return

    with torch.no_grad():
        traced = torch.jit.trace(model, dummy_input)

    labels = [class_map[str(i)] for i in range(len(class_map))]
    mlmodel = ct.convert(
        traced,
        inputs=[ct.ImageType(
            name="image",
            shape=dummy_input.shape,
            scale=1.0 / 255.0,
            bias=[-0.485 / 0.229, -0.456 / 0.224, -0.406 / 0.225],
            color_layout=ct.colorlayout.RGB,
        )],
        classifier_config=ct.ClassifierConfig(labels),
        minimum_deployment_target=ct.target.iOS16,
        convert_to="mlprogram",
    )
    mlmodel.short_description = "Central European Insect Classifier — 20 species"
    out_path = out_dir / "insect_classifier.mlpackage"
    mlmodel.save(str(out_path))
    print(f"  ✓ CoreML: {out_path}")
    print("    Drag into Xcode → ready for Vision framework on iOS/macOS")


def export_pte(model, dummy_input, out_dir):
    """Export to ExecuTorch .pte for react-native-executorch."""
    try:
        from torch.export import export as torch_export
        from executorch.exir import to_edge_transform_and_lower
    except ImportError:
        print("  Skipping .pte — executorch not installed")
        print("    pip install executorch")
        print("    https://pytorch.org/executorch/stable/getting-started-setup.html")
        print("  After install:")
        print("    1. Re-run: python 04_export.py --pte")
        print("    2. Set MODEL_SOURCE in src/ai/executorchVision.ts to:")
        print("         require('../../assets/models/insect_classifier.pte')")
        print("    3. Set USE_NATIVE_VISION = true in src/ai/index.ts")
        return

    try:
        with torch.no_grad():
            exported = torch_export(model, (dummy_input,))
        edge_prog  = to_edge_transform_and_lower(exported)
        exec_prog  = edge_prog.to_executorch()
        out_path   = out_dir / "insect_classifier.pte"
        with open(out_path, "wb") as f:
            f.write(exec_prog.buffer)
        size_mb = out_path.stat().st_size / 1e6
        print(f"  ✓ ExecuTorch .pte: {out_path}  ({size_mb:.1f} MB)")
        print("  Next steps:")
        print("    Set MODEL_SOURCE in src/ai/executorchVision.ts to:")
        print("      require('../../assets/models/insect_classifier.pte')")
        print("    Then set USE_NATIVE_VISION = true in src/ai/index.ts")
    except Exception as e:
        print(f"  ExecuTorch export failed: {e}")
        print("    Try updating executorch: pip install -U executorch")


def copy_class_map(class_map, out_dir):
    out_path = out_dir / "class_map.json"
    with open(out_path, "w") as f:
        json.dump(class_map, f, indent=2)
    print(f"  ✓ class_map.json: {out_path}")


def write_ts_class_map(class_map, ts_path):
    """Generate src/ai/classMap.ts from the checkpoint's class_map."""
    num = len(class_map)
    index_lines = []
    for i in range(num):
        sci = class_map[str(i)]
        bug_id = SCIENTIFIC_TO_BUG_ID.get(sci, sci)
        comment = sci
        index_lines.append(f"  '{bug_id}', // {i:2d}  {comment}")

    sci_pairs = []
    for i in range(num):
        sci = class_map[str(i)]
        bug_id = SCIENTIFIC_TO_BUG_ID.get(sci, sci)
        sci_pairs.append(f"  '{sci}':{' ' * (27 - len(sci))}'{bug_id}',")

    content = """\
/**
 * Maps the vision model's outputs to app bug IDs.
 *
 * AUTO-GENERATED by training/local/04_export.py — do not edit by hand.
 * Re-run 04_export.py after retraining to keep this in sync.
 *
 * Two lookup shapes:
 *   - SCIENTIFIC_TO_BUG_ID  scientific name  → bug ID  (Gemini path)
 *   - INDEX_TO_BUG_ID       class index → bug ID       (native ONNX/CoreML path)
 *
 * Index ordering matches training/local/checkpoints/class_map_lite.json.
 */

export const SCIENTIFIC_TO_BUG_ID: Readonly<Record<string, string>> = {
"""
    content += "\n".join(sci_pairs) + "\n};\n\n"
    content += "/** Index order matches class_map_lite.json produced by train_lite.py. */\n"
    content += "export const INDEX_TO_BUG_ID: ReadonlyArray<string> = [\n"
    content += "\n".join(index_lines) + "\n];\n\n"
    content += """\
/** Convenience: look up bug ID by class index, with bounds-check. */
export function indexToBugId(idx: number): string | undefined {
  return INDEX_TO_BUG_ID[idx];
}
"""
    ts_path.write_text(content)
    print(f"  ✓ classMap.ts: {ts_path}")


def main():
    parser = argparse.ArgumentParser(description="Export insect classifier for mobile")
    parser.add_argument("--lite", action="store_true", help="Force lite checkpoint (MobileNetV3-Small)")
    parser.add_argument("--full", action="store_true", help="Force full checkpoint (EfficientNetV2-S)")
    parser.add_argument("--pte",  action="store_true", help="Also attempt ExecuTorch .pte export (requires pip install executorch)")
    args = parser.parse_args()

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    ckpt_path = pick_checkpoint(args)
    print(f"\nLoading {ckpt_path.name}...")
    model, class_map, num_classes = load_model(ckpt_path)

    dummy = torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE)

    if args.pte:
        print("\nExporting to ExecuTorch .pte...")
        export_pte(model, dummy, ASSETS_DIR)

    print("\nExporting to ONNX...")
    export_onnx(model, dummy, ASSETS_DIR)

    print("\nExporting to CoreML...")
    export_coreml(model, dummy, class_map, ASSETS_DIR)

    print("\nWriting class map...")
    copy_class_map(class_map, ASSETS_DIR)

    print("\nGenerating TypeScript class map...")
    write_ts_class_map(class_map, TS_CLASS_MAP)

    print(f"\n{'─' * 56}")
    print(f"Export complete → {ASSETS_DIR}")
    print("""
Primary path (react-native-executorch):
  1. python 04_export.py --pte   (needs: pip install executorch)
  2. Set MODEL_SOURCE in src/ai/executorchVision.ts to:
       require('../../assets/models/insect_classifier.pte')
  3. Set USE_NATIVE_VISION = true in src/ai/index.ts
  4. expo prebuild && npx pod-install   (iOS)
     expo prebuild && ./gradlew build  (Android)

Fallback paths:
  Android ONNX Runtime:
    copy assets/models/insect_classifier.onnx
      → android/app/src/main/assets/
  iOS CoreML:
    drag assets/models/insect_classifier.mlpackage into Xcode
""")


if __name__ == "__main__":
    main()
