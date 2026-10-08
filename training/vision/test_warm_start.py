"""Tests for train.py's warm start (classifier rows carried over by Latin name).

  python -m pytest training/vision/test_warm_start.py
"""

import csv

import timm
import torch

from train import copy_head_rows, head_row_map, warm_start


def test_row_map_matches_by_latin_name_regardless_of_order():
    old = ["Apis mellifera", "Musca domestica", "Aglais io"]
    new = ["Aglais io", "Culex pipiens", "Apis mellifera"]  # reordered, one new, one dropped
    assert head_row_map(old, new) == [(0, 2), (2, 0)]


def test_copy_head_rows_moves_rows_and_leaves_new_species_untouched():
    old_w = torch.arange(6.0).reshape(3, 2)
    old_b = torch.tensor([10.0, 11.0, 12.0])
    new_w = torch.full((3, 2), -1.0)
    new_b = torch.full((3,), -1.0)
    copy_head_rows(new_w, new_b, old_w, old_b, [(0, 2), (2, 0)])
    assert new_w.tolist() == [[4.0, 5.0], [-1.0, -1.0], [0.0, 1.0]]
    assert new_b.tolist() == [12.0, -1.0, 10.0]


def test_warm_start_loads_body_and_maps_head(tmp_path):
    arch = "vit_tiny_patch16_224"
    old = timm.create_model(arch, num_classes=3)
    torch.save(old.state_dict(), tmp_path / "best.pth")
    with (tmp_path / "labels.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["index", "taxon_id", "latin"])
        for i, (tid, name) in enumerate([(1, "Apis mellifera"), (2, "Musca domestica"), (3, "Aglais io")]):
            w.writerow([i, tid, name])

    new = timm.create_model(arch, num_classes=4)
    fresh_row = new.head.weight[1].clone()
    kept, added = warm_start(new, tmp_path / "best.pth", tmp_path / "labels.csv",
                             ["Aglais io", "Culex pipiens", "Apis mellifera", "Blatta orientalis"])
    assert (kept, added) == (2, 2)
    # Body weights come from the old model.
    assert torch.equal(new.blocks[0].attn.qkv.weight, old.blocks[0].attn.qkv.weight)
    # Carried-over species keep their old row; new species keep their fresh one.
    assert torch.equal(new.head.weight[0], old.head.weight[2])
    assert torch.equal(new.head.weight[2], old.head.weight[0])
    assert torch.equal(new.head.bias[2], old.head.bias[0])
    assert torch.equal(new.head.weight[1], fresh_row)
