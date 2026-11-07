"""Apply fetched and reviewed common names to the Central Europe pack and bump its manifest version."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
BAD = {"Aulocera circe", "Groene schildpadkever", "Groen zuringhaantje", "Carilia virginea", "Anorthoa munda"}  # Latin synonyms / Dutch from Wikidata
names = json.load(open(ROOT / "tools/names/names.json"))
reviewed = json.load(open(ROOT / "tools/names/reviewed.json"))
pack_path = ROOT / "packs/eu-ce.json"
manifest_path = ROOT / "packs/manifest.json"
pack = json.loads(pack_path.read_text(encoding="utf-8"))
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
n = 0
for b in pack["bugs"]:
    latin = b["latin"]
    got = {l: (v[:1].upper() + (v[1:].lower() if l != "de" else v[1:])) for l, v in names.get(latin, {}).items() if v not in BAD}
    got.update(reviewed.get(latin, {}))
    if got:
        b["names"] = got
        n += 1
    else:
        b.pop("names", None)
pack["version"] += 1
manifest["packs"][pack["id"]]["version"] = pack["version"]
pack_path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print("species with names", n, "version", pack["version"])
