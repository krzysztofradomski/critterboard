"""
STEP 4: Export Model for Mobile Deployment
==========================================
Converts your trained PyTorch model to:
  - ONNX  → Android / cross-platform
  - CoreML → iOS (runs on Apple Neural Engine)

Usage:
    pip install coremltools onnx onnxruntime
    python 04_export.py
"""

import json
import torch
from pathlib import Path

try:
    import timm
except ImportError:
    print("pip install timm"); raise SystemExit(1)

CHECKPOINT_DIR = Path("./checkpoints")
EXPORT_DIR     = Path("./exported")
EXPORT_DIR.mkdir(exist_ok=True)
IMAGE_SIZE = 224

def load_model(device):
    ckpt = torch.load(CHECKPOINT_DIR / "best_model.pth", map_location=device)
    model = timm.create_model(
        ckpt["model_name"], pretrained=False, num_classes=ckpt["num_classes"]
    )
    model.load_state_dict(ckpt["model_state"])
    model.eval()
    return model, ckpt["class_map"], ckpt["num_classes"]

def export_onnx(model, dummy_input, class_map):
    out_path = EXPORT_DIR / "insect_classifier.onnx"
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
    # Save class labels alongside
    with open(EXPORT_DIR / "classes_onnx.json", "w") as f:
        json.dump(class_map, f, indent=2)

    size_mb = out_path.stat().st_size / 1e6
    print(f"  ✓ ONNX saved: {out_path}  ({size_mb:.1f} MB)")

    # Quick validation
    try:
        import onnxruntime as ort
        import numpy as np
        sess = ort.InferenceSession(str(out_path))
        inp  = dummy_input.numpy()
        out  = sess.run(None, {"image": inp})
        print(f"    ONNX validation OK — output shape: {out[0].shape}")
    except ImportError:
        print("    (install onnxruntime to validate: pip install onnxruntime)")

def export_coreml(model, dummy_input, class_map):
    try:
        import coremltools as ct
    except ImportError:
        print("  Skipping CoreML — install with: pip install coremltools")
        return

    # Trace the model
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
        convert_to="mlprogram",   # uses newer .mlpackage format
    )

    mlmodel.short_description = "European Insect Classifier"
    mlmodel.author             = "Your Name"
    mlmodel.license            = "See LICENSE"

    out_path = EXPORT_DIR / "insect_classifier.mlpackage"
    mlmodel.save(str(out_path))
    print(f"  ✓ CoreML saved: {out_path}")
    print(f"    Drop this into your Xcode project — ready to use with Vision framework")

def main():
    device = torch.device("cpu")   # export always on CPU for compatibility
    print(f"Loading checkpoint...")
    model, class_map, num_classes = load_model(device)
    print(f"  Classes: {num_classes}  |  Model: loaded OK")

    dummy = torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE)

    print("\nExporting to ONNX...")
    export_onnx(model, dummy, class_map)

    print("\nExporting to CoreML...")
    export_coreml(model, dummy, class_map)

    print(f"\n{'─'*50}")
    print(f"Export complete. Files in: {EXPORT_DIR.resolve()}")
    print("""
What to do with these files:

  insect_classifier.onnx
    → Android: use ONNX Runtime for Android
      https://onnxruntime.ai/docs/tutorials/mobile/

  insect_classifier.mlpackage
    → iOS: drag into Xcode, use with:
      import CoreML, Vision
      let model = try! VNCoreMLModel(for: insect_classifier())
""")

if __name__ == "__main__":
    main()
