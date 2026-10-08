"""Tests for the field-robust pipeline.  cd training/vision && python -m pytest test_field.py"""
import csv
import gzip

import download


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
