"""Fetch taxonomy (class/order/family) and regions for every pack species from GBIF.

Writes tools/facts/taxa.json: {latin: {class, order, family, continents:[GBIF regions]}}.
Run: python3 tools/facts/fetch_taxonomy.py
"""
import json, pathlib, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[2]
latins = sorted({b["latin"] for b in json.load(open(ROOT / "packs/eu-ce.json"))["bugs"]})

def get(url):
    for attempt in range(5):
        try:
            return json.load(urllib.request.urlopen(url, timeout=60))
        except Exception:
            time.sleep(2 * (attempt + 1))  # GBIF throttles bursts of occurrence searches
    return {}

def one(latin):
    m = get("https://api.gbif.org/v1/species/match?name=" + urllib.parse.quote(latin))
    key = m.get("usageKey")
    out = {"class": m.get("class"), "order": m.get("order"), "family": m.get("family")}
    if key:
        f = get(f"https://api.gbif.org/v1/occurrence/search?taxonKey={key}&limit=0&facet=GBIF_REGION&facetLimit=10")
        facets = f.get("facets") or []
        counts = {c["name"]: c["count"] for c in (facets[0]["counts"] if facets else [])}
        total = sum(counts.values()) or 1
        # Keep regions with at least 1% of records (and 20+), to drop stray or misplaced points.
        out["continents"] = [k for k, v in sorted(counts.items(), key=lambda kv: -kv[1]) if v / total >= 0.01 and v >= 20]
    return latin, out

with ThreadPoolExecutor(3) as ex:
    res = dict(ex.map(one, latins))
json.dump(res, open(ROOT / "tools/facts/taxa.json", "w"), ensure_ascii=False, indent=1, sort_keys=True)
import collections
print("orders", collections.Counter(v.get("order") for v in res.values()).most_common(30))
print("families", len({v.get("family") for v in res.values()}), "with continents", sum(1 for v in res.values() if v.get("continents")))
