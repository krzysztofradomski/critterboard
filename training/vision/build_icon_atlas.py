"""Pack the species icons from make_icons.py into one atlas for a region pack.

The atlas is the icons' .webp files back to back; the pack JSON gets an
`icons` block with the atlas URL, an icon version and each bug's byte range.
The app downloads the atlas once and splits it on the device
(src/data/bugIcons.ts). Also writes CREDITS.md next to the atlas, with the
source photo, photographer and licence of every icon.

  python build_icon_atlas.py --icons ~/icons/out --labels results/commercial-1k-v1/labels.csv \\
      --observers $DATA/observers.tsv --pack packs/eu-ce.json --manifest packs/manifest.json \\
      --atlas packs/icons/eu-ce-icons-v1.bin --url <raw URL of the atlas> --icons-version 1 --pack-version 5
"""

import argparse
import csv
import json
import re
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--icons", type=Path, required=True, help="make_icons.py output dir (with selection.csv)")
    ap.add_argument("--labels", type=Path, required=True, help="labels.csv (taxon_id, latin)")
    ap.add_argument("--observers", type=Path, required=True, help="observers.tsv (id, login, name)")
    ap.add_argument("--pack", type=Path, required=True)
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--atlas", type=Path, required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--icons-version", type=int, required=True)
    ap.add_argument("--pack-version", type=int, required=True)
    args = ap.parse_args()

    taxon_of = {r["latin"]: r["taxon_id"] for r in csv.DictReader(args.labels.open())}
    selection = {r["taxon_id"]: r for r in csv.DictReader((args.icons / "selection.csv").open())}
    observers = {}
    with args.observers.open() as f:
        next(f)
        for line in f:
            oid, login, name = (line.rstrip("\n").split("\t") + ["", ""])[:3]
            observers[oid] = (login, name)

    pack = json.loads(args.pack.read_text())
    index, blobs, credits, offset = {}, [], [], 0
    for bug in pack["bugs"]:
        tax = taxon_of.get(bug["latin"])
        f = args.icons / f"{tax}.webp"
        if tax is None or not f.exists():
            continue
        data = f.read_bytes()
        assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", f
        index[bug["id"]] = [offset, len(data)]
        blobs.append(data)
        offset += len(data)
        s = selection[tax]
        login, name = observers.get(s["observer_id"], ("", ""))
        credits.append((bug["latin"], s["photo_id"], s["license"], name or login, login))

    args.atlas.parent.mkdir(parents=True, exist_ok=True)
    args.atlas.write_bytes(b"".join(blobs))
    pack["version"] = args.pack_version
    pack["icons"] = {"url": args.url, "version": args.icons_version, "index": index}
    text = json.dumps(pack, indent=2, ensure_ascii=False) + "\n"
    # One line per index entry instead of four.
    text = re.sub(r"\[\n\s+(\d+),\n\s+(\d+)\n\s+\]", r"[\1, \2]", text)
    args.pack.write_text(text)

    manifest = json.loads(args.manifest.read_text())
    manifest["packs"][pack["id"]]["version"] = args.pack_version
    args.manifest.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    by = sum(1 for c in credits if c[2] == "CC-BY")
    lines = [
        f"# Species icon credits — `{pack['id']}` icons v{args.icons_version}",
        "",
        "Each icon is a cartoon drawn from one iNaturalist photo (cut out, colours flattened,",
        "outlined). Photos are CC0 unless marked CC-BY 4.0; CC-BY photos are adapted and",
        "credited below as the licence requires (https://creativecommons.org/licenses/by/4.0/).",
        "",
        f"{len(credits)} icons: {len(credits) - by} from CC0 photos, {by} from CC-BY photos.",
        "",
        "| Species | Photo | Licence | Photographer |",
        "|---|---|---|---|",
    ]
    for latin, pid, lic, who, login in sorted(credits):
        person = f"{who} ([{login}](https://www.inaturalist.org/people/{login}))" if login else who
        lines.append(f"| *{latin}* | [{pid}](https://www.inaturalist.org/photos/{pid}) | {lic} | {person} |")
    (args.atlas.parent / "CREDITS.md").write_text("\n".join(lines) + "\n")
    print(f"{len(index)} icons, {offset / 1e6:.1f} MB atlas, {by} CC-BY; "
          f"{len(pack['bugs']) - len(index)} bugs without an icon")


if __name__ == "__main__":
    main()
