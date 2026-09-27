"""Sample a commercially usable training set (CC0 + CC-BY photos only).

Input  $DATA/species.csv, $DATA/commercial/cand.tsv (stream_commercial_photos.sh)
       $DATA/observers.tsv (optional, observer_id -> login, name; for credits)
Output $DATA/commercial/{species.csv, sampled.tsv, photos.tsv} — the same
       layout download.py / train.py expect, so the rest of the pipeline is
       unchanged when run with --data $DATA/commercial.

Photo licences:
  CC0    no conditions.
  CC-BY  commercial use allowed with attribution -> credits.csv lists every
         photographer; ship it (or a link to it) with the app.
  Excluded: any NC (non-commercial), ND (no derivatives) and SA (share-alike:
  could require the model itself to be released under CC-BY-SA).
"""

import argparse
import csv
import random
import shutil
from collections import defaultdict
from pathlib import Path

ALLOWED = {"CC0", "CC-BY"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--per-species", type=int, default=400)
    ap.add_argument("--max-per-observer", type=int, default=3)
    ap.add_argument("--test", type=int, default=40)
    ap.add_argument("--val", type=int, default=30)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    out = args.data / "commercial"

    species = list(csv.DictReader((args.data / "species.csv").open()))
    by_species = defaultdict(lambda: defaultdict(list))  # taxon -> observer -> rows
    for line in (out / "cand.tsv").open():
        photo_id, ext, lic, uuid, observer, taxon = line.rstrip("\n").split("\t")
        if lic in ALLOWED:
            by_species[taxon][observer].append((photo_id, ext, lic, uuid))

    shutil.copy(args.data / "species.csv", out / "species.csv")
    counts = []
    with (out / "sampled.tsv").open("w") as fs, (out / "photos.tsv").open("w") as fp, \
            (out / "picked.tsv").open("w") as fk:
        for s in species:
            taxon = s["taxon_id"]
            observers = list(by_species[taxon])
            rng.shuffle(observers)
            picked = []
            for o in observers:
                rows = by_species[taxon][o]
                rng.shuffle(rows)
                picked += [(r, o) for r in rows[: args.max_per_observer]]
                if len(picked) >= args.per_species:
                    break
            picked = picked[: args.per_species]

            # Observer-grouped split; scale test/val down for sparse species.
            n = len(picked)
            want_test = min(args.test, n // 8)
            want_val = min(args.val, n // 10)
            split_of, n_test, n_val = {}, 0, 0
            per_obs = defaultdict(int)
            for _, o in picked:
                per_obs[o] += 1
            for _, o in picked:
                if o in split_of:
                    continue
                if n_test < want_test:
                    split_of[o], n_test = "test", n_test + per_obs[o]
                elif n_val < want_val:
                    split_of[o], n_val = "val", n_val + per_obs[o]
                else:
                    split_of[o] = "train"
            for (photo_id, ext, lic, uuid), o in picked:
                fs.write(f"{uuid}\t{taxon}\t{split_of[o]}\n")
                fp.write(f"{photo_id}\t{ext}\t{lic}\t{uuid}\n")
                fk.write(f"{photo_id}\t{lic}\t{o}\t{taxon}\n")
            counts.append((n, s["latin"]))

    counts.sort()
    total = sum(c for c, _ in counts)
    print(f"{total:,} photos for {len(counts)} species (CC0 + CC-BY only)")
    print("fewest:", ", ".join(f"{name} ({c})" for c, name in counts[:10]))
    print(f"species below 100 photos: {sum(1 for c, _ in counts if c < 100)}")


if __name__ == "__main__":
    main()
