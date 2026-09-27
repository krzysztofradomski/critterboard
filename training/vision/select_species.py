"""Pick the most-observed European insect/arachnid species and sample photos.

Input (built by stream_obs.sh / stream_photos.sh from the iNaturalist AWS Open
Data dumps, see README.md):
  taxa.tsv      taxon_id, ancestry, rank_level, rank, name, active
  eu_obs.tsv    obs_uuid, observer_id, species_id   (research grade, Europe bbox)

Output:
  species.csv   class index order: taxon_id, latin, class, order, family, obs_count
  sampled.tsv   obs_uuid, taxon_id, split   (train / val / test, grouped by observer)

Usage:
  python select_species.py --data /path/to/vdata --top 200 --per-species 400
"""

import argparse
import csv
import random
from collections import Counter, defaultdict
from pathlib import Path

# The 20 species the app already knows (src/data/bugs.ts) — always included so
# existing ids, catches and translations keep working.
FORCE_INCLUDE = [
    "Apis mellifera", "Bombus terrestris", "Bombus hortorum", "Vespula vulgaris",
    "Vespa crabro", "Coccinella septempunctata", "Harmonia axyridis",
    "Lucanus cervus", "Cetonia aurata", "Palomena prasina", "Aglais io",
    "Vanessa cardui", "Vanessa atalanta", "Anthocharis cardamines",
    "Gonepteryx rhamni", "Aglais urticae", "Pieris brassicae", "Pieris rapae",
    "Papilio machaon", "Enallagma cyathigerum",
]


def load_taxa(path: Path):
    by_id, by_name = {}, {}
    with path.open() as f:
        next(f)
        for line in f:
            tid, ancestry, _lvl, rank, name, active = line.rstrip("\n").split("\t")
            by_id[tid] = (ancestry, rank, name)
            if rank == "species" and active == "true":
                by_name[name] = tid
    return by_id, by_name


def lineage(tid, by_id):
    """rank -> name for the taxon's ancestors (order, family, class, …)."""
    out = {}
    ancestry = by_id[tid][0]
    for aid in ancestry.split("/"):
        if aid in by_id:
            _, rank, name = by_id[aid]
            out[rank] = name
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--top", type=int, default=200)
    ap.add_argument("--per-species", type=int, default=400)
    ap.add_argument("--max-per-observer", type=int, default=3)
    ap.add_argument("--test", type=int, default=40, help="test observations per species")
    ap.add_argument("--val", type=int, default=30, help="val observations per species")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    by_id, by_name = load_taxa(args.data / "taxa.tsv")

    counts = Counter()
    obs_by_species = defaultdict(list)
    with (args.data / "eu_obs.tsv").open() as f:
        for line in f:
            uuid, observer, sid = line.rstrip("\n").split("\t")
            counts[sid] += 1
            obs_by_species[sid].append((uuid, observer))

    forced = [by_name[n] for n in FORCE_INCLUDE]
    missing = [n for n in FORCE_INCLUDE if by_name.get(n) not in counts]
    if missing:
        raise SystemExit(f"forced species with no European observations: {missing}")

    chosen = list(dict.fromkeys(forced + [sid for sid, _ in counts.most_common()]))
    chosen = chosen[: max(args.top, len(forced))]
    chosen.sort(key=lambda sid: -counts[sid])

    with (args.data / "species.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["taxon_id", "latin", "class", "order", "family", "obs_count"])
        for sid in chosen:
            lin = lineage(sid, by_id)
            w.writerow([sid, by_id[sid][2], lin.get("class", ""), lin.get("order", ""),
                        lin.get("family", ""), counts[sid]])

    # Sample observations: cap per observer (diversity), then split by observer
    # so no photographer appears in both train and test.
    with (args.data / "sampled.tsv").open("w") as out:
        for sid in chosen:
            by_observer = defaultdict(list)
            for uuid, observer in obs_by_species[sid]:
                by_observer[observer].append(uuid)
            observers = list(by_observer)
            rng.shuffle(observers)
            picked = []  # (uuid, observer)
            for o in observers:
                uuids = by_observer[o]
                rng.shuffle(uuids)
                picked += [(u, o) for u in uuids[: args.max_per_observer]]
                if len(picked) >= args.per_species:
                    break
            picked = picked[: args.per_species]

            split_of, n_test, n_val = {}, 0, 0
            for _, o in picked:
                if o in split_of:
                    continue
                if n_test < args.test:
                    split_of[o] = "test"
                elif n_val < args.val:
                    split_of[o] = "val"
                else:
                    split_of[o] = "train"
                k = sum(1 for _, oo in picked if oo == o)
                if split_of[o] == "test":
                    n_test += k
                elif split_of[o] == "val":
                    n_val += k
            for u, o in picked:
                out.write(f"{u}\t{sid}\t{split_of[o]}\n")

    total = sum(counts[s] for s in chosen)
    print(f"{len(chosen)} species, {total:,} European research-grade observations")
    print(f"least observed: {by_id[chosen[-1]][2]} ({counts[chosen[-1]]:,})")


if __name__ == "__main__":
    main()
