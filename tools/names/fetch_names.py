"""Look up pl/de/es common names for every pack species on Wikidata (by Latin name, P225).

Usage: python3 tools/names/fetch_names.py   -> writes tools/names/names.json
Only keeps labels that differ from the Latin name (Wikidata falls back to it).
"""
import json, urllib.request, urllib.parse, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
bugs = json.load(open(ROOT / "packs/eu-ce.json"))["bugs"]
LANGS = ["pl", "de", "es"]
out = {}
latins = sorted({b["latin"] for b in bugs})

# Three sources, best first: the item's label, its "taxon common name" (P1843), its Wikipedia title.
PARTS = [
    "?t rdfs:label ?lab . BIND(LANG(?lab) AS ?l)",
    "?t wdt:P1843 ?lab . BIND(LANG(?lab) AS ?l)",
    "?s schema:about ?t ; schema:name ?lab ; schema:isPartOf ?site . BIND(SUBSTR(STR(?site), 9, 2) AS ?l)",
]

def query(chunk, part):
    vals = " ".join('"%s"' % l for l in chunk)
    q = """SELECT ?n ?l ?lab WHERE {
      VALUES ?n { %s }
      ?t wdt:P225 ?n .
      %s
      FILTER(?l IN ("pl","de","es"))
    }""" % (vals, part)
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q)
    req = urllib.request.Request(url, headers={"User-Agent": "critterboard-names/1.0 (stronginarm@gmail.com)"})
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=90))["results"]["bindings"]
        except Exception as e:
            print("retry", e); time.sleep(5 * (attempt + 1))
    return []

import re
GENERA = {l.split()[0] for l in latins}
LATIN_END = re.compile(r"(us|um|is|ii|ae|ata|ana|ica|ensis|alis|aria|ella|iana)$")

def looks_latin(lab):
    w = lab.split()
    if not re.fullmatch(r"[A-Za-z .\-]+", lab):
        return False
    return w[0] in GENERA or (len(w) == 2 and w[0][0].isupper() and w[1].islower() and bool(LATIN_END.search(w[1])))

for i in range(0, len(latins), 80):
    for pi, part in enumerate(PARTS):
        for r in query(latins[i:i + 80], part):
            n, l, lab = r["n"]["value"], r["l"]["value"], r["lab"]["value"]
            if lab.lower() == n.lower() or lab.startswith("Q") or lab.split()[0].lower() == n.split()[0].lower():
                continue
            if looks_latin(lab) or (l == "es" and pi == 2):
                continue  # Latin synonym / genus-based title / unreliable es wiki title: not a vernacular name
            out.setdefault(n, {}).setdefault(l, lab)
    print(i, len(out), flush=True)
json.dump(out, open(ROOT / "tools/names/names.json", "w"), ensure_ascii=False, indent=1, sort_keys=True)
cov = {l: sum(1 for v in out.values() if l in v) for l in LANGS}
print("species", len(latins), "coverage", cov)
