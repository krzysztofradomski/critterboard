"""Export a trained checkpoint to ExecuTorch (.pte) with the XNNPACK delegate
and verify it by running the .pte itself on the held-out test split.

Use executorch==1.0.1: react-native-executorch 0.9.3 bundles an ExecuTorch
1.0-era runtime (program format ET12). ExecuTorch guarantees backward
compatibility from 1.0 on, so an older exporter is the safe choice.

  python export.py --data /path/to/vdata --arch vit_small_patch16_224 \\
      --ckpt runs/vits/best.pth --out runs/vits [--int8]
"""

import argparse
import csv
import json
import time
from pathlib import Path

import timm
import torch
from torch.utils.data import DataLoader

from train import Photos, eval_tf, load_species


def build(arch, ckpt, n_cls):
    model = timm.create_model(arch, num_classes=n_cls)
    model.load_state_dict(torch.load(ckpt, map_location="cpu"))
    return model.eval()


def quantize_int8(model, example, calib_loader, n_batches):
    from executorch.backends.xnnpack.quantizer.xnnpack_quantizer import (
        XNNPACKQuantizer,
        get_symmetric_quantization_config,
    )
    from torchao.quantization.pt2e.quantize_pt2e import convert_pt2e, prepare_pt2e

    quantizer = XNNPACKQuantizer().set_global(get_symmetric_quantization_config(is_per_channel=True))
    m = torch.export.export(model, (example,)).module()
    m = prepare_pt2e(m, quantizer)
    with torch.no_grad():
        for i, (x, _) in enumerate(calib_loader):
            if i >= n_batches:
                break
            for xi in x:  # graph was exported for batch size 1
                m(xi[None])
    return convert_pt2e(m)


def to_pte(model, example, path: Path):
    from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
    from executorch.exir import to_edge_transform_and_lower

    ep = torch.export.export(model, (example,))
    prog = to_edge_transform_and_lower(ep, partitioner=[XnnpackPartitioner()]).to_executorch()
    path.write_bytes(prog.buffer)


def eval_pte(path: Path, loader, limit: int = 0):
    from executorch.runtime import Runtime

    method = Runtime.get().load_program(str(path)).load_method("forward")
    top1 = top3 = n = 0
    t = 0.0
    for x, y in loader:
        for xi, yi in zip(x, y):
            t0 = time.time()
            logits = method.execute([xi[None].contiguous()])[0][0]
            t += time.time() - t0
            pred = logits.topk(3).indices
            top1 += int(pred[0] == yi)
            top3 += int((pred == yi).any())
            n += 1
            if limit and n >= limit:
                return top1 / n, top3 / n, 1000 * t / n
    return top1 / n, top3 / n, 1000 * t / n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--arch", required=True)
    ap.add_argument("--ckpt", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--size", type=int, default=224)
    ap.add_argument("--int8", action="store_true")
    ap.add_argument("--calib-batches", type=int, default=16)
    ap.add_argument("--limit", type=int, default=0, help="smoke test: score only N test images")
    args = ap.parse_args()
    torch.set_num_threads(4)

    species = load_species(args.data)
    model = build(args.arch, args.ckpt, len(species))
    example = torch.randn(1, 3, args.size, args.size)
    test_loader = DataLoader(Photos(args.data, "test", species, eval_tf(args.size)),
                             batch_size=64, shuffle=bool(args.limit))

    if args.int8:
        calib = DataLoader(Photos(args.data, "train", species, eval_tf(args.size)),
                           batch_size=32, shuffle=True)
        model = quantize_int8(model, example, calib, args.calib_batches)

    name = "model_int8.pte" if args.int8 else "model_fp32.pte"
    path = args.out / name
    to_pte(model, example, path)
    top1, top3, ms = eval_pte(path, test_loader, args.limit)
    report = {"pte": name, "mb": round(path.stat().st_size / 1e6, 1),
              "test_top1": top1, "test_top3": top3, "host_ms_per_image": round(ms, 1)}
    (args.out / f"{path.stem}_report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))

    # Class order for the app's labelMap (index -> latin).
    with (args.out / "labels.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["index", "taxon_id", "latin"])
        for i, s in enumerate(species):
            w.writerow([i, s["taxon_id"], s["latin"]])


if __name__ == "__main__":
    main()
