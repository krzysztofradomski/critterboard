"""Download sampled photos from the iNaturalist open-data bucket and shrink them.

Reads sampled.tsv + photos.tsv (or a run's credits.csv.gz with --credits), fetches `photos/<id>/medium.<ext>` (≤500 px),
resizes so the short side is 256 px and writes
  images/<split>/<taxon_id>/<photo_id>.jpg
plus images/manifest.csv (photo_id, taxon_id, split, license) for attribution.

Usage:
  python download.py --data /path/to/vdata --threads 48
  python download.py --data /path/to/vdata --credits results/household-v3/credits.csv.gz --short-side 224
    (rebuilds that run's exact photo list and split; needs the run's species.csv in --data)
"""

import argparse
import csv
import gzip
import io
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import urllib3
from PIL import Image

BUCKET = "https://inaturalist-open-data.s3.amazonaws.com/photos"


# One pool for all threads: keep-alive connections and a single TLS context
# (a fresh urllib context per request reloads the CA bundle: ~0.3 s CPU each).
POOL = urllib3.PoolManager(maxsize=64, retries=urllib3.Retry(3, backoff_factor=1.5),
                           timeout=urllib3.Timeout(30))


class NotFound(Exception):
    pass


def fetch(url: str) -> bytes:
    r = POOL.request("GET", url)
    if r.status in (403, 404):  # the bucket answers 403 for keys that don't exist
        raise NotFound(url)
    if r.status != 200:
        raise RuntimeError(f"HTTP {r.status}")
    return r.data


def fetch_photo(photo_id: str, exts=("jpg", "jpeg", "png")):
    """medium.<ext> for a photo whose extension isn't known (credits.csv.gz has none)."""
    for ext in exts:
        try:
            return fetch(f"{BUCKET}/{photo_id}/medium.{ext}")
        except NotFound:
            continue
    return None


def rows_from_credits(credits_gz: Path, species_csv: Path):
    """Rebuild a run's exact photo list and split from its credits.csv.gz."""
    with species_csv.open() as f:
        taxon = {r["latin"]: r["taxon_id"] for r in csv.DictReader(f)}
    with gzip.open(credits_gz, "rt") as f:
        return [(r["photo_id"], None, r["license"], taxon[r["species"]], r["split"])
                for r in csv.DictReader(f) if r["species"] in taxon]


def process(row, out_root: Path, short_side: int):
    photo_id, ext, _lic, taxon_id, split = row
    dest = out_root / split / taxon_id / f"{photo_id}.jpg"
    if dest.exists():
        return True
    try:
        data = fetch_photo(photo_id) if ext is None else fetch(f"{BUCKET}/{photo_id}/medium.{ext}")
        if data is None:
            return False
        img = Image.open(io.BytesIO(data)).convert("RGB")
        w, h = img.size
        s = short_side / min(w, h)
        if s < 1:
            img = img.resize((round(w * s), round(h * s)), Image.BICUBIC)
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, "JPEG", quality=90)
        return True
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--threads", type=int, default=48)
    ap.add_argument("--short-side", type=int, default=256, help="resize so the short side is this many px")
    ap.add_argument("--credits", type=Path, help="a run's credits.csv.gz instead of sampled.tsv + photos.tsv")
    args = ap.parse_args()

    if args.credits:
        rows = rows_from_credits(args.credits, args.data / "species.csv")
    else:
        sampled = {}
        with (args.data / "sampled.tsv").open() as f:
            for line in f:
                uuid, taxon_id, split = line.rstrip("\n").split("\t")
                sampled[uuid] = (taxon_id, split)

        rows = []
        with (args.data / "photos.tsv").open() as f:
            for line in f:
                photo_id, ext, lic, uuid = line.rstrip("\n").split("\t")
                taxon_id, split = sampled[uuid]
                rows.append((photo_id, ext, lic, taxon_id, split))

    out_root = args.data / "images"
    ok = failed = 0
    with ThreadPoolExecutor(args.threads) as pool:
        futures = {pool.submit(process, r, out_root, args.short_side): r for r in rows}
        for i, fut in enumerate(as_completed(futures), 1):
            if fut.result():
                ok += 1
            else:
                failed += 1
            if i % 2000 == 0:
                print(f"{i}/{len(rows)}  ok={ok} failed={failed}", flush=True)

    with (out_root / "manifest.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["photo_id", "taxon_id", "split", "license"])
        for photo_id, _ext, lic, taxon_id, split in rows:
            if (out_root / split / taxon_id / f"{photo_id}.jpg").exists():
                w.writerow([photo_id, taxon_id, split, lic])
    print(f"done: ok={ok} failed={failed}")


if __name__ == "__main__":
    main()
