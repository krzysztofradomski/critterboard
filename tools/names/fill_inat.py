"""Fill remaining gaps in tools/names/names.json from iNaturalist (locale-specific preferred names).

iNaturalist falls back to the English name when a locale has none, so a name only counts when it
differs from `english_common_name`. Polite rate: ~1 request/second.
"""
import json, pathlib, re, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
PATH = ROOT / "tools/names/names.json"
names = json.load(open(PATH))
latins = sorted({b["latin"] for b in json.load(open(ROOT / "packs/eu-ce.json"))["bugs"]})
GENERA = {l.split()[0] for l in latins}

def lookup(latin, lang):
    url = "https://api.inaturalist.org/v1/taxa?rank=species&per_page=3&locale=%s&q=%s" % (lang, urllib.parse.quote(latin))
    for _ in range(3):
        try:
            for r in json.load(urllib.request.urlopen(url, timeout=30))["results"]:
                if r["name"] != latin:
                    continue
                v, en = (r.get("preferred_common_name") or "").strip(), (r.get("english_common_name") or "").strip()
                if v and v.lower() != en.lower() and v.split()[0] not in GENERA:
                    return v
                return None
            return None
        except Exception:
            time.sleep(3)
    return None

n = 0
for lang in ("es", "pl", "de"):
    for latin in latins:
        if lang in names.get(latin, {}):
            continue
        v = lookup(latin, lang)
        time.sleep(1)
        if v:
            names.setdefault(latin, {})[lang] = v
            n += 1
    json.dump(names, open(PATH, "w"), ensure_ascii=False, indent=1, sort_keys=True)
    print(lang, "done", n, flush=True)
print({l: sum(1 for v in names.values() if l in v) for l in ("es", "pl", "de")})
