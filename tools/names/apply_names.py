"""Merge tools/names/names.json into packs/eu-ce.json as per-species `names` ({pl,de,es}) and bump the pack version."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
BAD = {"Aulocera circe", "Groene schildpadkever", "Groen zuringhaantje", "Carilia virginea", "Anorthoa munda"}  # Latin synonyms / Dutch from Wikidata
names = json.load(open(ROOT / "tools/names/names.json"))
pack = json.load(open(ROOT / "packs/eu-ce.json"))
n = 0
for b in pack["bugs"]:
    got = {l: (v[:1].upper() + (v[1:].lower() if l != "de" else v[1:])) for l, v in names.get(b["latin"], {}).items() if v not in BAD}
    if got:
        b["names"] = got
        n += 1
    else:
        b.pop("names", None)
pack["version"] += 1
json.dump(pack, open(ROOT / "packs/eu-ce.json", "w"), ensure_ascii=False, indent=2)
print("species with names", n, "version", pack["version"])
