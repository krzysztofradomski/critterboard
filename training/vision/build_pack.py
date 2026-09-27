"""Write region pack JSON (bugs + labelMap + model URL) for a trained model.

Species that already exist in the current pack keep their bug entry untouched
(ids, names, rarity), so existing catches, quests and translations stay valid.
New species get an id from their latin name and traits/emoji/colour from
their taxonomy; rarity comes from how often they are observed in Europe.

  python build_pack.py --data /path/to/vdata --labels runs/x/labels.csv \\
      --pack ../../packs/eu-ce.json --version 3 --model-url https://...
"""

import argparse
import csv
import json
from pathlib import Path

HERE = Path(__file__).parent

BUTTERFLY_FAMILIES = {"Nymphalidae", "Lycaenidae", "Pieridae", "Papilionidae",
                      "Hesperiidae", "Riodinidae"}
DAMSELFLY_FAMILIES = {"Coenagrionidae", "Calopterygidae", "Platycnemididae", "Lestidae"}

ORDER_STYLE = {  # emoji, colour
    "Coleoptera": ("🪲", "#5a3a22"),
    "Hymenoptera": ("🐝", "#f0b020"),
    "Lepidoptera": ("🦋", "#e8903a"),
    "Odonata": ("🪰", "#2a8fb5"),
    "Diptera": ("🪰", "#8a7a3a"),
    "Hemiptera": ("🪲", "#3d8c30"),
    "Araneae": ("🕷️", "#6b5a4a"),
    "Opiliones": ("🕷️", "#8a6a4a"),
    "Orthoptera": ("🦗", "#6aa040"),
    "Mantodea": ("🦗", "#7ab648"),
}


def traits(order, family, latin):
    if order == "Coleoptera":
        return ["beetle"]
    if order == "Hemiptera":
        return ["bug"]
    if order == "Lepidoptera":
        return ["butterfly", "pollinator"] if family in BUTTERFLY_FAMILIES else []
    if order == "Odonata":
        return ["damselfly"] if family in DAMSELFLY_FAMILIES else []
    if order == "Hymenoptera":
        if family == "Apidae":
            return ["pollinator"]
        if family == "Vespidae":
            return ["wasp"] if latin.startswith("Vespa ") else ["wasp", "pollinator"]
        return ["wasp"]
    if order == "Diptera" and family in {"Syrphidae", "Bombyliidae"}:
        return ["pollinator"]
    return []


def rarity(obs_count):
    """European research-grade observation count → rarity, xp, tier."""
    if obs_count >= 50_000:
        return "common", 20, "★"
    if obs_count >= 20_000:
        return "uncommon", 45, "★★"
    return "rare", 90, "★★★"


def slug(latin):
    return latin.lower().replace(" ", "-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--pack", type=Path, required=True)
    ap.add_argument("--version", type=int, required=True)
    ap.add_argument("--model-url", required=True)
    args = ap.parse_args()

    old = json.loads(args.pack.read_text())
    existing = {b["latin"]: b for b in old["bugs"]}
    names = {r["latin"]: r["name"] for r in csv.DictReader((HERE / "names_en.csv").open())}
    species = {r["latin"]: r for r in csv.DictReader((args.data / "species.csv").open())}
    labels = list(csv.DictReader(args.labels.open()))

    bugs, label_map = [], {}
    for row in labels:
        latin = row["latin"]
        label_map[latin] = int(row["index"])
        if latin in existing:
            bugs.append(existing[latin])
            continue
        s = species[latin]
        emoji, color = ORDER_STYLE.get(s["order"], ("🐛", "#8a7a5a"))
        if s["family"] == "Coccinellidae":
            emoji, color = "🐞", "#d72638"
        r, xp, tier = rarity(int(s["obs_count"]))
        bugs.append({
            "id": slug(latin), "name": names[latin], "latin": latin,
            "rarity": r, "xp": xp, "tier": tier, "emoji": emoji, "color": color,
            "traits": traits(s["order"], s["family"], latin),
        })

    ids = [b["id"] for b in bugs]
    assert len(set(ids)) == len(ids), "duplicate bug ids"
    assert sorted(label_map.values()) == list(range(len(labels))), "labelMap must be 0..N-1"

    pack = {
        "id": old["id"],
        "version": args.version,
        "modelUrl": args.model_url,
        "modelVersion": args.version,
        "bugs": bugs,
        "labelMap": label_map,
    }
    args.pack.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {args.pack}: {len(bugs)} bugs ({len(existing)} kept), version {args.version}")


if __name__ == "__main__":
    main()
