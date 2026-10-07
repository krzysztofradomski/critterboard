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
from collections import defaultdict
from pathlib import Path

from splits import split_of_observer

ALLOWED = {"CC0", "CC-BY"}


def main():
    ap = argparse.ArgumentParser(allow_abbrev=False)  # a misspelt flag must not silently match another
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--top", type=int, default=0, help="keep the first N species (by observation rank) with enough photos; 0 = all")
    ap.add_argument("--min-photos", type=int, default=0, help="skip species with fewer usable photos")
    ap.add_argument("--min-photos-forced", type=int, default=None,
                    help="lower minimum for forced (household) species; default: --min-photos")
    ap.add_argument("--per-species", type=int, default=400)
    ap.add_argument("--max-per-observer", type=int, default=3)
    ap.add_argument("--test-frac", type=float, default=0.10, help="share of photographers held out for test")
    ap.add_argument("--val-frac", type=float, default=0.065, help="share of photographers held out for validation")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    out = args.data / "commercial"

    species = list(csv.DictReader((args.data / "species.csv").open()))
    by_species = defaultdict(lambda: defaultdict(list))  # taxon -> observer -> rows
    for line in (out / "cand.tsv").open():
        photo_id, ext, lic, uuid, observer, taxon, grade = line.rstrip("\n").split("\t")
        if lic in ALLOWED:
            by_species[taxon][observer].append((grade != "research", photo_id, ext, lic, uuid))

    # 1. Pick photos per species (observer-capped), in observation-rank order.
    chosen = []  # (species row, picked)
    for s in species:
        taxon = s["taxon_id"]
        observers = list(by_species[taxon])
        rng.shuffle(observers)
        # Research grade first (the labels are confirmed); needs-ID photos only top up.
        observers.sort(key=lambda o: min(by_species[taxon][o])[0])
        picked = []
        for o in observers:
            rows = by_species[taxon][o]
            rng.shuffle(rows)
            rows.sort(key=lambda r: r[0])
            picked += [(r[1:], o) for r in rows[: args.max_per_observer]]
            if len(picked) >= args.per_species:
                break
        picked = picked[: args.per_species]
        forced = s.get("forced") == "1"
        min_photos = args.min_photos_forced if forced and args.min_photos_forced is not None else args.min_photos
        if len(picked) < min_photos:
            if forced:
                print(f"forced species dropped, {len(picked)} photos: {s['latin']}")
            continue
        chosen.append((s, picked))
        if args.top and len(chosen) >= args.top:
            break

    # 2. Write the class list and the observer-grouped split.
    with (out / "species.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(species[0].keys()))
        w.writeheader()
        w.writerows(s for s, _ in chosen)

    counts = []
    with (out / "sampled.tsv").open("w") as fs, (out / "photos.tsv").open("w") as fp, \
            (out / "picked.tsv").open("w") as fk:
        for s, picked in chosen:
            taxon = s["taxon_id"]
            split_of = {o: split_of_observer(o, args.seed, args.test_frac, args.val_frac) for _, o in picked}
            for (photo_id, ext, lic, uuid), o in picked:
                fs.write(f"{uuid}\t{taxon}\t{split_of[o]}\n")
                fp.write(f"{photo_id}\t{ext}\t{lic}\t{uuid}\n")
                fk.write(f"{photo_id}\t{lic}\t{o}\t{taxon}\n")
            counts.append((len(picked), s["latin"]))

    split_counts = defaultdict(int)
    for line in (out / "sampled.tsv").open():
        split_counts[line.rstrip("\n").split("\t")[2]] += 1
    print("split (photos):", dict(split_counts))
    counts.sort()
    total = sum(c for c, _ in counts)
    print(f"{total:,} photos for {len(counts)} species (CC0 + CC-BY only)")
    print("fewest:", ", ".join(f"{name} ({c})" for c, name in counts[:10]))
    print(f"species below 100 photos: {sum(1 for c, _ in counts if c < 100)}")
    print(f"deepest rank used: {species.index(chosen[-1][0]) + 1} of {len(species)} candidates")


if __name__ == "__main__":
    main()
