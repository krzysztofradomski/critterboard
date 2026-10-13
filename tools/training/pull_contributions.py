"""Download players' shared training photos into the training layout.

  CRITTERBOARD_TRAINING_TOKEN=... python3 tools/training/pull_contributions.py \\
      --base https://<worker host> --out $DATA [--since <ms>] [--species training/vision/results/field-v7/species.csv]
  python3 tools/training/pull_contributions.py --selftest

Writes $DATA/contrib/<split>/<taxon_id>/<id>.jpg, contrib/manifest.csv (every field) and
contrib/credits.csv (CC BY 4.0 credit per photo, for the next model's ATTRIBUTION.md).
The split comes from a hash of the contributor pseudonym, so one player's photos never
straddle train and test. Prints the newest created_at, to pass as --since next time.
"""
import argparse
import csv
import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path

FIELDS = ["id", "contributor", "bug_id", "latin", "kind", "top3", "aim", "model_version", "pack_version",
          "credit_name", "licence", "at", "created_at", "bytes"]


def split_of(contributor: str) -> str:
    b = hashlib.sha256(contributor.encode()).digest()[0]
    return "test" if b < 38 else "val" if b < 64 else "train"  # ~15% / ~10% / ~75%


def get(url: str, token: str | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"} if token else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def pull(base: str, token: str, since: int, out: Path, latin_to_taxon: dict, fetch=get) -> dict:
    root = out / "contrib"
    root.mkdir(parents=True, exist_ok=True)
    rows, skipped, newest, deleted = [], 0, since, set()
    while True:
        page = json.loads(fetch(f"{base}/v1/training/export?since={since}&limit=500", token))
        deleted.update(d["id"] for d in page.get("deleted", []))
        for it in page["items"]:
            newest = max(newest, it["created_at"])
            taxon = latin_to_taxon.get(it["latin"])
            if taxon is None:
                skipped += 1
                continue
            dest = root / split_of(it["contributor"]) / taxon / f"{it['id']}.jpg"
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(fetch(base + it["object"], None))
            rows.append(it)
        if page.get("next") is None:
            break
        since = page["next"]
    removed = prune(root, deleted)
    new_file = not (root / "manifest.csv").exists()
    with (root / "manifest.csv").open("a", newline="") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(FIELDS)
        for it in rows:
            w.writerow([json.dumps(it[k]) if isinstance(it.get(k), (list, dict)) else it.get(k) for k in FIELDS])
    new_file = not (root / "credits.csv").exists()
    with (root / "credits.csv").open("a", newline="") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["photo_id", "credit_name", "licence", "species"])
        for it in rows:
            w.writerow([it["id"], it["credit_name"], it["licence"], it["latin"]])
    return {"downloaded": len(rows), "skipped_unknown_species": skipped, "removed": removed, "newest": newest}


def prune(root: Path, ids: set) -> int:
    """Players deleted these: remove the local photos and their manifest/credits rows."""
    if not ids:
        return 0
    removed = 0
    for photo in root.glob("*/*/*.jpg"):
        if photo.stem in ids:
            photo.unlink()
            removed += 1
    for name in ("manifest.csv", "credits.csv"):
        f = root / name
        if f.exists():
            lines = f.read_text().splitlines(keepends=True)
            f.write_text("".join(lines[:1] + [l for l in lines[1:] if l.split(",", 1)[0] not in ids]))
    return removed


def selftest() -> None:
    import tempfile
    jpeg = b"\xff\xd8\xff\xe0" + b"x" * 10
    pages = {
        0: {"items": [
            {"id": "c_a", "contributor": "p1", "bug_id": "harl", "latin": "Harmonia axyridis", "kind": "manual",
             "top3": [{"bug_id": "lady", "p": 0.4}], "aim": {"tap": [0.5, 0.5]}, "model_version": 7, "pack_version": 14,
             "credit_name": "Ann", "licence": "CC-BY-4.0", "at": 1, "created_at": 10, "bytes": 14, "object": "/o/c_a"},
            {"id": "c_b", "contributor": "p2", "bug_id": "x", "latin": "Unknown species", "kind": "confirmed",
             "top3": [], "aim": {}, "model_version": 7, "pack_version": 14, "credit_name": "Ben", "licence": "CC-BY-4.0",
             "at": 2, "created_at": 20, "bytes": 14, "object": "/o/c_b"},
        ], "next": None},
    }

    def fake(url, token):
        if "/v1/training/export" in url:
            assert token == "tok"
            return json.dumps(pages[0]).encode()
        assert token is None and url.endswith("/o/c_a")
        return jpeg

    with tempfile.TemporaryDirectory() as d:
        # A photo pulled earlier whose player has since deleted it.
        old = Path(d) / "contrib" / "train" / "48484" / "c_old.jpg"
        old.parent.mkdir(parents=True)
        old.write_bytes(jpeg)
        (Path(d) / "contrib" / "credits.csv").write_text("photo_id,credit_name,licence,species\nc_old,Zed,CC-BY-4.0,Harmonia axyridis\n")
        pages[0]["deleted"] = [{"id": "c_old", "deleted_at": 15}]
        r = pull("https://w", "tok", 0, Path(d), {"Harmonia axyridis": "48484"}, fetch=fake)
        assert r == {"downloaded": 1, "skipped_unknown_species": 1, "removed": 1, "newest": 20}, r
        assert not old.exists(), "a deleted contribution is removed locally"

        photo = Path(d) / "contrib" / split_of("p1") / "48484" / "c_a.jpg"
        assert photo.read_bytes() == jpeg
        credits = (Path(d) / "contrib" / "credits.csv").read_text().splitlines()
        assert credits == ["photo_id,credit_name,licence,species", "c_a,Ann,CC-BY-4.0,Harmonia axyridis"], credits
        assert split_of("p1") == split_of("p1") and {split_of(f"p{i}") for i in range(200)} == {"train", "val", "test"}
    print("selftest ok")


def main() -> None:
    if "--selftest" in sys.argv:
        selftest()
        return
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="worker origin, e.g. https://critterboard-api.<account>.workers.dev")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--since", type=int, default=0)
    ap.add_argument("--species", type=Path, default=Path(__file__).resolve().parents[2] / "training/vision/results/field-v7/species.csv")
    args = ap.parse_args()
    token = os.environ.get("CRITTERBOARD_TRAINING_TOKEN")
    if not token:
        sys.exit("set CRITTERBOARD_TRAINING_TOKEN (the worker's TRAINING_ADMIN_TOKEN)")
    with args.species.open() as f:
        latin_to_taxon = {r["latin"]: r["taxon_id"] for r in csv.DictReader(f)}
    print(pull(args.base.rstrip("/"), token, args.since, args.out, latin_to_taxon))


if __name__ == "__main__":
    main()
