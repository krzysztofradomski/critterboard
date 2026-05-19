"""
STEP 1: Setup & Download 20-Species Mini Dataset
================================================
Run this first. Downloads ~2GB of data from iNaturalist S3.
Takes ~15-30 minutes depending on your connection.

Usage:
    python 01_setup_and_download.py
"""

import os
import json
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd

# ── Config ─────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path("./data/images")
META_DIR   = Path("./data/meta")
LOG_FILE   = Path("./data/download_log.json")

# 20 common, visually distinct Central European insect species
# Format: (taxon_id, common_name, scientific_name)
TARGET_SPECIES = [
    (47219,  "Seven-spot Ladybird",        "Coccinella septempunctata"),
    (48484,  "European Honey Bee",          "Apis mellifera"),
    (52747,  "Common Brimstone",            "Gonepteryx rhamni"),
    (48484,  "Buff-tailed Bumblebee",       "Bombus terrestris"),
    (57593,  "Peacock Butterfly",           "Aglais io"),
    (55626,  "Large White Butterfly",       "Pieris brassicae"),
    (57508,  "Red Admiral",                 "Vanessa atalanta"),
    (57583,  "Small Tortoiseshell",         "Aglais urticae"),
    (52775,  "Cabbage White",               "Pieris rapae"),
    (48735,  "Common Wasp",                 "Vespula vulgaris"),
    (61585,  "Stag Beetle",                 "Lucanus cervus"),
    (119870, "Green Shield Bug",            "Palomena prasina"),
    (56057,  "Common Blue Damselfly",       "Enallagma cyathigerum"),
    (61525,  "Rose Chafer",                 "Cetonia aurata"),
    (52798,  "Orange Tip",                  "Anthocharis cardamines"),
    (57486,  "Painted Lady",                "Vanessa cardui"),
    (48745,  "European Hornet",             "Vespa crabro"),
    (52786,  "Common Swallowtail",          "Papilio machaon"),
    (60827,  "Harlequin Ladybird",          "Harmonia axyridis"),
    (48480,  "Garden Bumblebee",            "Bombus hortorum"),
]

# Remove duplicate taxon_ids if any slipped in above
seen, UNIQUE_SPECIES = set(), []
for item in TARGET_SPECIES:
    if item[0] not in seen:
        seen.add(item[0])
        UNIQUE_SPECIES.append(item)

IMAGES_PER_SPECIES = 150   # enough to train/val/test split
MAX_WORKERS        = 12    # parallel downloads
INAT_S3_BASE       = "https://inaturalist-open-data.s3.amazonaws.com"
INAT_API_BASE      = "https://api.inaturalist.org/v1"

# ── Helpers ─────────────────────────────────────────────────────────────────

def fetch_json(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "InsectApp/0.1"})
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)


def fetch_observations(taxon_id: int, limit: int = 200) -> list[dict]:
    """
    Pull research-grade observations from iNaturalist API.
    Filters to Europe by bounding box.
    Returns list of {photo_url, obs_id} dicts.
    """
    photos = []
    page   = 1
    per_page = 100

    while len(photos) < limit:
        url = (
            f"{INAT_API_BASE}/observations"
            f"?taxon_id={taxon_id}"
            f"&quality_grade=research"
            f"&photos=true"
            f"&nelat=71&nelng=45&swlat=34&swlng=-25"   # Europe bbox
            f"&per_page={per_page}&page={page}"
            f"&order_by=votes"   # most-voted = highest quality
        )
        try:
            data = fetch_json(url)
        except Exception as e:
            print(f"    API error for taxon {taxon_id}: {e}")
            break

        results = data.get("results", [])
        if not results:
            break

        for obs in results:
            for photo in obs.get("photos", []):
                url_med = photo.get("url", "").replace("square", "medium")
                if url_med:
                    photos.append({
                        "obs_id":   obs["id"],
                        "photo_id": photo["id"],
                        "url":      url_med,
                    })
                    if len(photos) >= limit:
                        break
            if len(photos) >= limit:
                break

        if len(results) < per_page:
            break   # no more pages
        page += 1
        time.sleep(0.5)   # be polite to the API

    return photos[:limit]


def download_image(args) -> tuple[bool, str]:
    url, dest_path = args
    if dest_path.exists():
        return True, str(dest_path)
    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "InsectApp/0.1"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
        with open(dest_path, "wb") as f:
            f.write(data)
        return True, str(dest_path)
    except Exception as e:
        return False, f"{url} → {e}"


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)

    # Save species manifest
    manifest = [
        {"taxon_id": t, "common_name": c, "scientific_name": s}
        for t, c, s in UNIQUE_SPECIES
    ]
    with open(META_DIR / "species_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"Downloading {len(UNIQUE_SPECIES)} species × ~{IMAGES_PER_SPECIES} images")
    print(f"Output: {OUTPUT_DIR.resolve()}\n")

    download_log = {}
    total_ok = total_fail = 0

    for taxon_id, common_name, sci_name in UNIQUE_SPECIES:
        species_dir = OUTPUT_DIR / str(taxon_id)
        species_dir.mkdir(exist_ok=True)

        print(f"  [{common_name}] Fetching observation list...", end=" ", flush=True)
        observations = fetch_observations(taxon_id, limit=IMAGES_PER_SPECIES + 20)
        print(f"{len(observations)} found")

        # Build download tasks
        tasks = []
        for obs in observations:
            ext  = obs["url"].split(".")[-1].split("?")[0] or "jpg"
            dest = species_dir / f"{obs['photo_id']}.{ext}"
            tasks.append((obs["url"], dest))

        # Download in parallel
        ok = fail = 0
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(download_image, t): t for t in tasks}
            for future in as_completed(futures):
                success, msg = future.result()
                if success:
                    ok += 1
                else:
                    fail += 1

        # Trim to exact IMAGES_PER_SPECIES (delete extras)
        files = sorted(species_dir.iterdir())
        for extra in files[IMAGES_PER_SPECIES:]:
            extra.unlink()

        actual = len(list(species_dir.iterdir()))
        download_log[str(taxon_id)] = {"ok": ok, "fail": fail, "actual": actual}
        total_ok   += ok
        total_fail += fail
        print(f"    ✓ {actual} images saved  ({fail} failed)")

    with open(LOG_FILE, "w") as f:
        json.dump(download_log, f, indent=2)

    print(f"\n{'─'*50}")
    print(f"Done. {total_ok} downloaded, {total_fail} failed.")
    print(f"Dataset size: ~{sum(f.stat().st_size for f in OUTPUT_DIR.rglob('*') if f.is_file()) / 1e6:.0f} MB")
    print(f"\nNext step: python 02_train.py")


if __name__ == "__main__":
    main()
