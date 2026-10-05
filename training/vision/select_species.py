"""Pick the most-observed European insect/arachnid species and sample photos.

Ranked by research-grade + needs-ID observations: research grade alone undercounts
species that are common but hard to confirm from photos (house flies, ants,
mosquitoes). Photos are sampled research grade first. The app's original species
and household_species.txt are always included, listed first so a later top-N
cut (select_commercial.py) keeps them.

Input (built by stream_obs.sh / stream_photos.sh from the iNaturalist AWS Open
Data dumps, see README.md):
  taxa.tsv      taxon_id, ancestry, rank_level, rank, name, active
  eu_obs.tsv    obs_uuid, observer_id, species_id, quality_grade   (Europe bbox;
                household species worldwide)

Output:
  species.csv   class index order: taxon_id, latin, class, order, family, obs_count, forced
  sampled.tsv   obs_uuid, taxon_id, split   (train / val / test, grouped by observer)

Usage:
  python select_species.py --data /path/to/vdata --top 200 --per-species 400
"""

import argparse
import csv
import random
from collections import Counter, defaultdict
from pathlib import Path

from splits import split_of_observer

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
HOUSEHOLD = [
    line.strip()
    for line in (Path(__file__).parent / "household_species.txt").read_text().splitlines()
    if line.strip() and not line.startswith("#")
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
    ap.add_argument("--test-frac", type=float, default=0.10, help="share of photographers held out for test")
    ap.add_argument("--val-frac", type=float, default=0.065, help="share of photographers held out for validation")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    by_id, by_name = load_taxa(args.data / "taxa.tsv")

    counts = Counter()
    obs_by_species = defaultdict(list)
    with (args.data / "eu_obs.tsv").open() as f:
        for line in f:
            uuid, observer, sid, grade = line.rstrip("\n").split("\t")
            counts[sid] += 1
            obs_by_species[sid].append((uuid, observer, grade == "research"))

    force_names = list(dict.fromkeys(FORCE_INCLUDE + HOUSEHOLD))
    missing = [n for n in force_names if by_name.get(n) not in counts]
    if missing:
        raise SystemExit(f"forced species with no observations (check the Latin name): {missing}")
    forced = [by_name[n] for n in force_names]

    chosen = list(dict.fromkeys(forced + [sid for sid, _ in counts.most_common()]))
    chosen = chosen[: max(args.top, len(forced))]
    # Forced first (a later top-N cut keeps them), then by observation count.
    forced_set = set(forced)
    chosen.sort(key=lambda sid: (sid not in forced_set, -counts[sid]))

    with (args.data / "species.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["taxon_id", "latin", "class", "order", "family", "obs_count", "forced"])
        for sid in chosen:
            lin = lineage(sid, by_id)
            w.writerow([sid, by_id[sid][2], lin.get("class", ""), lin.get("order", ""),
                        lin.get("family", ""), counts[sid], int(sid in forced_set)])

    # Sample observations: cap per observer (diversity), then split by observer
    # globally (hash of observer id), so no photographer appears in both train
    # and test, even across different species.
    with (args.data / "sampled.tsv").open("w") as out:
        for sid in chosen:
            by_observer = defaultdict(list)
            for uuid, observer, research in obs_by_species[sid]:
                by_observer[observer].append((not research, uuid))
            observers = list(by_observer)
            rng.shuffle(observers)
            observers.sort(key=lambda o: min(by_observer[o])[0])  # observers with research grade first
            picked = []  # (uuid, observer)
            for o in observers:
                uuids = by_observer[o]
                rng.shuffle(uuids)
                uuids.sort(key=lambda t: t[0])  # research grade first (stable: still shuffled within)
                picked += [(u, o) for _, u in uuids[: args.max_per_observer]]
                if len(picked) >= args.per_species:
                    break
            picked = picked[: args.per_species]

            split_of = {o: split_of_observer(o, args.seed, args.test_frac, args.val_frac) for _, o in picked}
            for u, o in picked:
                out.write(f"{u}\t{sid}\t{split_of[o]}\n")

    total = sum(counts[s] for s in chosen)
    print(f"{len(chosen)} species ({len(forced)} forced), {total:,} research-grade + needs-ID observations")
    least = min(chosen, key=counts.__getitem__)
    print(f"least observed: {by_id[least][2]} ({counts[least]:,})")


if __name__ == "__main__":
    main()
