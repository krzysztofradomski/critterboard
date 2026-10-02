"""Fetch English Wikipedia articles for every pack species and pull a body size out of the text.

Pass 1 reads the lead of 20 pages per request; pass 2 reads the full article for species whose lead has no size.

Writes tools/facts/wiki_en.json: {latin: {"title": ..., "size_mm": [lo, hi] | null, "kind": "length"|"wingspan"|null}}.
Run: python3 tools/facts/fetch_wiki.py
"""
import json, pathlib, re, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
latins = sorted({b["latin"] for b in json.load(open(ROOT / "packs/eu-ce.json"))["bugs"]})
API = "https://en.wikipedia.org/w/api.php"

def get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "critterboard-facts/1.0 (hello@critterboard.app)"})
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=60))
        except Exception:
            time.sleep(3 * (attempt + 1))
    return {}

NUM = r"(\d+(?:[.,]\d+)?)"
RANGE = re.compile(NUM + r"\s*(?:[–\-]|to)\s*" + NUM + r"\s*(mm|millimet\w+|cm|centimet\w+)")
SINGLE = re.compile(NUM + r"\s*(mm|millimet\w+|cm|centimet\w+)")

def to_mm(v, unit):
    v = float(v.replace(",", "."))
    return v * 10 if unit.startswith("c") else v

def parse_size(text):
    """Return ([lo, hi] mm, kind) from sentences that mention a length or wingspan, else (None, None)."""
    for sent in re.split(r"(?<=[.!?])\s+", text):
        low = sent.lower()
        kind = "wingspan" if "wingspan" in low or "wing span" in low else "length" if re.search(r"\b(long|length|body)\b", low) else None
        if not kind:
            continue
        m = RANGE.search(sent)
        if m:
            lo, hi = to_mm(m.group(1), m.group(3)), to_mm(m.group(2), m.group(3))
        else:
            m = SINGLE.search(sent)
            if not m:
                continue
            lo = hi = to_mm(m.group(1), m.group(2))
        if 0.3 <= lo <= hi <= 300:
            return [round(lo, 1), round(hi, 1)], kind
    return None, None

out = {}
for i in range(0, len(latins), 20):
    chunk = latins[i:i + 20]
    r = get({"action": "query", "format": "json", "redirects": 1, "prop": "extracts", "exintro": 1, "explaintext": 1,
             "exlimit": "max", "titles": "|".join(chunk)})
    q = r.get("query", {})
    back = {}  # final title -> requested title
    for n in q.get("normalized", []):
        back[n["to"]] = n["from"]
    for rd in q.get("redirects", []):
        back[rd["to"]] = back.get(rd["from"], rd["from"])
    for page in q.get("pages", {}).values():
        req = back.get(page.get("title"), page.get("title"))
        if req in chunk and page.get("extract"):
            size, kind = parse_size(page["extract"])
            out[req] = {"title": page["title"], "size_mm": size, "kind": kind}
    print(i, len(out), flush=True)
from concurrent.futures import ThreadPoolExecutor

def full_text_size(latin):
    r = get({"action": "query", "format": "json", "redirects": 1, "prop": "extracts", "explaintext": 1, "titles": out[latin]["title"]})
    for page in r.get("query", {}).get("pages", {}).values():
        return latin, parse_size(page.get("extract") or "")
    return latin, (None, None)

todo = [k for k, v in out.items() if not v["size_mm"]]
with ThreadPoolExecutor(6) as ex:
    for latin, (size, kind) in ex.map(full_text_size, todo):
        if size:
            out[latin]["size_mm"], out[latin]["kind"] = size, kind
json.dump(out, open(ROOT / "tools/facts/wiki_en.json", "w"), ensure_ascii=False, indent=1, sort_keys=True)
print("pages", len(out), "with size", sum(1 for v in out.values() if v["size_mm"]))
