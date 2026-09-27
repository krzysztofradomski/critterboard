"""Photographer credits for a commercially licensed training set.

CC-BY requires attribution. Writes credits.csv (one row per training photo
actually downloaded) and prints a per-licence summary.

  python credits.py --data $DATA --out results/<run>/credits.csv
"""

import argparse
import csv
from collections import Counter
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True, help="dir with observers.tsv and commercial/")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    com = args.data / "commercial"

    observers = {}
    with (args.data / "observers.tsv").open() as f:
        next(f)
        for line in f:
            oid, login, name = (line.rstrip("\n").split("\t") + ["", ""])[:3]
            observers[oid] = (login, name)

    observer_of = {}
    for line in (com / "picked.tsv").open():
        photo_id, _lic, observer, _taxon = line.rstrip("\n").split("\t")
        observer_of[photo_id] = observer

    latin = {r["taxon_id"]: r["latin"] for r in csv.DictReader((com / "species.csv").open())}
    licences, people = Counter(), set()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with (com / "images" / "manifest.csv").open() as f, args.out.open("w", newline="") as g:
        w = csv.writer(g)
        w.writerow(["photo_id", "license", "photographer", "inaturalist_login",
                    "species", "split", "source"])
        for r in csv.DictReader(f):
            login, name = observers.get(observer_of[r["photo_id"]], ("", ""))
            w.writerow([r["photo_id"], r["license"], name or login, login,
                        latin[r["taxon_id"]], r["split"],
                        f"https://www.inaturalist.org/photos/{r['photo_id']}"])
            licences[r["license"]] += 1
            people.add(login)
    print(f"{sum(licences.values()):,} photos by {len(people):,} photographers: {dict(licences)}")


if __name__ == "__main__":
    main()
