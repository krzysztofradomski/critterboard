"""Tests for the field-robust pipeline.  cd training/vision && python -m pytest test_field.py"""
import csv
import gzip

import numpy as np

import download
import scan_crops as sc


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
