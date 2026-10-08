"""Tests for the field-robust pipeline.  cd training/vision && python -m pytest test_field.py"""
import csv
import gzip
import random
import subprocess

import numpy as np
import torch
from PIL import Image

import calibrate
import download
import export
import field_aug as fa
import field_eval as fe
import scan_crops as sc
import train


def _write(tmp_path):
    sp = tmp_path / "species.csv"
    with sp.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["taxon_id", "latin"])
        w.writerow(["48484", "Harmonia axyridis"])
    cr = tmp_path / "credits.csv.gz"
    with gzip.open(cr, "wt", newline="") as f:
        w = csv.writer(f)
        w.writerow(["photo_id", "license", "photographer", "inaturalist_login", "species", "split", "source"])
        w.writerow(["1", "CC0", "A", "a", "Harmonia axyridis", "test", ""])
        w.writerow(["2", "CC-BY", "B", "b", "Harmonia axyridis", "train", ""])
        w.writerow(["3", "CC-BY", "C", "c", "Not in species", "train", ""])
    return cr, sp


def test_rows_from_credits_maps_latin_to_taxon_and_keeps_split(tmp_path):
    cr, sp = _write(tmp_path)
    assert download.rows_from_credits(cr, sp) == [
        ("1", None, "CC0", "48484", "test"), ("2", None, "CC-BY", "48484", "train")]


def test_fetch_photo_tries_extensions(monkeypatch):
    tried = []

    def fake(url):
        tried.append(url.rsplit(".", 1)[1])
        if url.endswith(".png"):
            return b"PNG"
        raise download.NotFound(url)

    monkeypatch.setattr(download, "fetch", fake)
    assert download.fetch_photo("7") == b"PNG"
    assert tried == ["jpg", "jpeg", "png"]

    def missing(url):
        raise download.NotFound(url)

    monkeypatch.setattr(download, "fetch", missing)
    assert download.fetch_photo("8") is None


def test_scan_crops_match_typescript():
    # Reference values printed by node --experimental-strip-types from the pure functions of
    # src/ai/scanCrops.ts (2026-10-08). Re-pin when that file changes.
    img = (3024, 4032)
    area = sc.reticle_in_photo(img, sc.APP_VIEW, sc.APP_RETICLE)
    assert np.allclose(area, (1512, 1854.72, 1092.4137931034481))
    assert sc.tile_rects(img, area) == [
        (966, 1308, 437, 437), (966, 1636, 437, 437), (966, 1964, 437, 437),
        (1294, 1308, 437, 437), (1294, 1636, 437, 437), (1294, 1964, 437, 437),
        (1621, 1308, 437, 437), (1621, 1636, 437, 437), (1621, 1964, 437, 437)]
    assert sc.crop_rects(img, area) == [(966, 1309, 1092, 1092), (638, 981, 1748, 1748), (0, 343, 3024, 3024)]
    assert sc.tap_rects(img, 100, 4000) == [(0, 3669, 363, 363), (0, 3276, 756, 756), (0, 2520, 1512, 1512)]


def test_combine_scores_best_of_group_then_mean():
    a = [np.array([0.2, 0.1]), np.array([0.1, 0.7])]
    b = [np.array([0.6, 0.3])]
    assert np.allclose(sc.combine_scores([a, b]), [0.35, 0.5])


def test_backgrounds_split_disjoint():
    ids = [str(i) for i in range(1000)]
    test = {i for i in ids if fa.bg_split(i) == "test"}
    assert 150 <= len(test) <= 250                               # ~20%
    assert test == {i for i in ids if fa.bg_split(i) == "test"}  # deterministic


def test_paste_puts_fg_at_side_and_position():
    bg = Image.new("RGB", (400, 400), (0, 0, 255))
    fg = Image.new("RGB", (200, 100), (255, 0, 0))
    out = fa.paste(fg, bg, side=100, xy=(50, 60))
    assert out.size == (400, 400)
    assert out.getpixel((100, 85)) == (255, 0, 0)   # centre of the pasted 100x50 photo
    assert out.getpixel((10, 10)) == (0, 0, 255)    # background untouched
    assert bg.getpixel((100, 85)) == (0, 0, 255)    # input not modified


def test_field_shot_returns_square_of_size(tmp_path):
    p = tmp_path / "b.jpg"
    Image.new("RGB", (500, 375), (0, 128, 0)).save(p)
    shot = fa.FieldShot([p], size=256)(Image.new("RGB", (298, 224), (255, 0, 0)))
    assert shot.size == (256, 256) and shot.mode == "RGB"


def test_degrade_keeps_size_and_mode():
    out = fa.degrade(Image.new("RGB", (256, 256), (120, 80, 40)), random.Random(0))
    assert out.size == (256, 256) and out.mode == "RGB"


def test_load_upright_applies_exif_rotation(tmp_path):
    p = tmp_path / "r.jpg"
    img = Image.new("RGB", (40, 20), (255, 0, 0))
    exif = img.getexif()
    exif[0x0112] = 6  # display rotated 90 degrees clockwise
    img.save(p, exif=exif)
    assert fe.load_upright(p).size == (20, 40)


def test_load_upright_converts_heic(tmp_path):
    jpg = tmp_path / "a.jpg"
    Image.new("RGB", (30, 10)).save(jpg)
    heic = tmp_path / "a.heic"
    subprocess.run(["sips", "-s", "format", "heic", str(jpg), "--out", str(heic)], check=True, capture_output=True)
    assert fe.load_upright(heic).size == (30, 10)


def test_app_crop_is_model_input_size():
    img = Image.new("RGB", (3024, 4032))
    assert fe.app_crop(img, (0, 0, 1000, 1000)).size == (256, 256)
    assert fe.app_crop(img, (0, 0, 120, 120)).size == (256, 256)    # small crop, upscaled
    assert fe.app_crop(img, (0, 0, 3024, 4032)).size == (256, 256)  # whole photo, squashed


def test_label_from_filename():
    idx = {"Coccinella septempunctata": 5}
    assert fe.label_from_name("Coccinella septempunctata 2.jpg", idx) == 5
    assert fe.label_from_name("IMG_1234.HEIC", idx) is None


def test_train_tf_without_backgrounds_is_unchanged():
    assert type(train.train_tf(256).transforms[0]).__name__ == "RandomResizedCrop"


def test_train_tf_with_field_p_gives_model_input(tmp_path):
    p = tmp_path / "b.jpg"
    Image.new("RGB", (500, 375), (0, 128, 0)).save(p)
    x = train.train_tf(256, backgrounds=[p], field_p=1.0)(Image.new("RGB", (298, 224), (255, 0, 0)))
    assert tuple(x.shape) == (3, 256, 256)


def test_fit_temperature_recovers_overconfidence():
    torch.manual_seed(0)
    logits = 3.0 * torch.randn(20000, 10)
    labels = torch.distributions.Categorical(logits=logits).sample()  # calibrated at T=1 by construction
    assert 0.9 <= calibrate.fit_temperature(logits, labels) <= 1.1
    assert 1.8 <= calibrate.fit_temperature(logits * 2.0, labels) <= 2.2  # made 2x too sharp


def test_scaled_divides_logits():
    m = torch.nn.Linear(3, 2)
    x = torch.randn(1, 3)
    assert torch.allclose(export.Scaled(m, 2.0)(x), m(x) / 2.0)
