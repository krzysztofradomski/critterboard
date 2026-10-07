"""Fetch when each pack species is seen: GBIF records per calendar month, in Europe.

Writes tools/facts/season.json: {latin: [12 record counts, Jan..Dec]} (missing when GBIF has none).
Run: python3 tools/facts/fetch_season.py
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
    key = get("https://api.gbif.org/v1/species/match?name=" + urllib.parse.quote(latin)).get("usageKey")
    if not key:
        return latin, None
    # Europe only: the packs are European, and a southern-hemisphere record would shift the season.
    f = get(f"https://api.gbif.org/v1/occurrence/search?taxonKey={key}&continent=EUROPE&limit=0&facet=month&facetLimit=12")
    facets = f.get("facets") or []
    counts = {int(c["name"]): c["count"] for c in (facets[0]["counts"] if facets else [])}
    months = [counts.get(m, 0) for m in range(1, 13)]
    return latin, months if sum(months) else None

with ThreadPoolExecutor(3) as ex:
    res = {k: v for k, v in ex.map(one, latins) if v}
json.dump(res, open(ROOT / "tools/facts/season.json", "w"), indent=0, sort_keys=True)
print("species with a season", len(res), "of", len(latins))
