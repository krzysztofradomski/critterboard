"""Fill gaps in tools/names/names.json (pl/de/es) from GBIF vernacular names (language spa/pol/deu).

Wikidata names stay; GBIF only fills languages a species lacks. Picks the name most sources agree on.
"""
import json, pathlib, re, urllib.parse, urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[2]
PATH = ROOT / "tools/names/names.json"
names = json.load(open(PATH))
latins = sorted({b["latin"] for b in json.load(open(ROOT / "packs/eu-ce.json"))["bugs"]})
CODE = {"spa": "es", "pol": "pl", "deu": "de"}
GENERA = {l.split()[0] for l in latins}

def get(url):
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(url, timeout=30))
        except Exception:
            pass
    return {}

def one(latin):
    have = names.get(latin, {})
    if all(l in have for l in CODE.values()):
        return latin, {}
    key = get("https://api.gbif.org/v1/species/match?name=" + urllib.parse.quote(latin)).get("usageKey")
    if not key:
        return latin, {}
    votes = {l: Counter() for l in CODE.values()}
    for r in get(f"https://api.gbif.org/v1/species/{key}/vernacularNames?limit=300").get("results", []):
        l, v = CODE.get(r.get("language")), r.get("vernacularName", "").strip()
        if l and v and l not in have and v.lower() != latin.lower() and v.split()[0] not in GENERA:
            votes[l][v[:1].upper() + v[1:]] += 1
    return latin, {l: c.most_common(1)[0][0] for l, c in votes.items() if c}

with ThreadPoolExecutor(8) as ex:
    for latin, got in ex.map(one, latins):
        if got:
            names.setdefault(latin, {}).update(got)
json.dump(names, open(PATH, "w"), ensure_ascii=False, indent=1, sort_keys=True)
print({l: sum(1 for v in names.values() if l in v) for l in CODE.values()})
