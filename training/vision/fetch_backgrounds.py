"""~800 CC0 research-grade European plant photos as busy backgrounds (iNaturalist API).

  python fetch_backgrounds.py --data $DATA [--pages 4]

Writes backgrounds/{train,test}/<photo_id>.jpg (split by field_aug.bg_split) and
backgrounds/manifest.csv. A plant photo can still show an insect now and then; that
noise is accepted.
"""
import argparse
import csv
import json
import time
import urllib.request
from pathlib import Path

from field_aug import bg_split

API = ("https://api.inaturalist.org/v1/observations?taxon_id=47126&place_id=97391"
       "&photo_license=cc0&quality_grade=research&per_page=200&order_by=id&page={}")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "critterboard-training"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--pages", type=int, default=4)
    args = ap.parse_args()
    root = args.data / "backgrounds"
    rows = []
    for page in range(1, args.pages + 1):
        for obs in json.loads(get(API.format(page)))["results"]:
            if not obs["photos"]:
                continue
            ph = obs["photos"][0]
            pid = str(ph["id"])
            split = bg_split(pid)
            dest = root / split / f"{pid}.jpg"
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                dest.write_bytes(get(ph["url"].replace("/square.", "/medium.")))
            rows.append([pid, split, "CC0", obs["user"]["login"], f"https://www.inaturalist.org/photos/{pid}"])
        time.sleep(1.0)  # iNaturalist asks for <= 1 request/s
    with (root / "manifest.csv").open("w", newline="") as f:
        csv.writer(f).writerows([["photo_id", "split", "license", "observer", "url"], *rows])
    print({s: sum(r[1] == s for r in rows) for s in ("train", "test")})


if __name__ == "__main__":
    main()
