"""Fetch a short description for every pack species: the first two sentences of its Wikipedia intro,
in each UI language (en, pl, de, es). Wikipedia texts are CC BY-SA; the app credits them.

A page counts only when its intro names the species' binomial, so a redirect to the genus or to a
look-alike is dropped. Parentheses (synonyms, author, etymology) are removed.

Writes tools/facts/about.json: {latin: {lang: text}}.
Run: python3 tools/facts/fetch_about.py
"""
import json, pathlib, re, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
latins = sorted({b["latin"] for b in json.load(open(ROOT / "packs/eu-ce.json"))["bugs"]})
LANGS = ("en", "pl", "de", "es")
MAX = 300

def get(lang, params):
    url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "critterboard-facts/1.0 (hello@critterboard.app)"})
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=20))
        except Exception:
            time.sleep(3 * (attempt + 1))
    return {}

# A sentence ends at . ! ? before a capital, but not after a lone initial ("L. 1758", "A. mellifera").
SENTENCE_END = re.compile(r"(?<![\s(][A-Z]\.)(?<=[.!?])\s+(?=[A-ZÀ-ÝĄĆĘŁŃÓŚŹŻ])")
# German writes ordinals with a period ("am 25. April"), so there a number never ends a sentence.
SENTENCE_END_DE = re.compile(r"(?<![\s(][A-Z]\.)(?<!\d\.)(?<=[.!?])\s+(?=[A-ZÀ-ÝÄÖÜ])")

def short(text, lang="en"):
    text = text.replace("​", "").split("\n")[0]
    while True:  # innermost first, so nested parentheses go too
        cut = re.sub(r"\s*\([^()]*\)", "", text)
        if cut == text:
            break
        text = cut
    text = re.sub(r"\s+([,.;:])", r"\1", re.sub(r"\s{2,}", " ", text)).strip()
    out = ""
    for s in (SENTENCE_END_DE if lang == "de" else SENTENCE_END).split(text)[:2]:
        if out and len(out) + 1 + len(s) > MAX:
            break
        out = f"{out} {s}".strip()
    # A cut-off or odd intro (an image caption, an unclosed quote) doesn't end like a sentence.
    return out if len(out) <= MAX and re.search(r"[.!?]$", out) else ""

def resolve(q):
    """Map each final page title back to the title that was asked for."""
    back = {n["to"]: n["from"] for n in q.get("normalized", [])}
    for rd in q.get("redirects", []):
        back[rd["to"]] = back.get(rd["from"], rd["from"])
    return back

def intros(lang, titles):
    """titles: {page title to ask for: latin}. Yields (latin, short text)."""
    q = get(lang, {"action": "query", "format": "json", "redirects": 1, "prop": "extracts", "exintro": 1,
                   "explaintext": 1, "exlimit": "max", "titles": "|".join(titles)}).get("query", {})
    back = resolve(q)
    for page in q.get("pages", {}).values():
        latin = titles.get(back.get(page.get("title"), page.get("title")))
        extract = page.get("extract") or ""
        if latin and latin.lower() in extract.lower():
            text = short(extract, lang)
            if len(text) >= 40:
                yield latin, text

def linked_titles(lang, chunk):
    """{title on the lang Wikipedia: latin}, from the English article's interlanguage links."""
    q = get("en", {"action": "query", "format": "json", "redirects": 1, "prop": "langlinks", "lllang": lang,
                   "lllimit": "max", "titles": "|".join(chunk)}).get("query", {})
    back = resolve(q)
    out = {}
    for page in q.get("pages", {}).values():
        latin = back.get(page.get("title"), page.get("title"))
        for link in page.get("langlinks") or []:
            if latin in chunk:
                out[link["*"]] = latin
    return out

out = {}
for lang in LANGS:
    # Pass 1: the Latin name as the title (most articles have it, or a redirect from it).
    for i in range(0, len(latins), 20):
        for latin, text in intros(lang, {l: l for l in latins[i:i + 20]}):
            out.setdefault(latin, {})[lang] = text
        print(lang, i, end="\r", flush=True)
    # Pass 2: articles under a vernacular title only, found through the English article's links.
    if lang != "en":
        missing = [l for l in latins if lang not in out.get(l, {})]
        for i in range(0, len(missing), 20):
            titles = linked_titles(lang, missing[i:i + 20])
            if titles:
                for latin, text in intros(lang, titles):
                    out.setdefault(latin, {})[lang] = text
            print(lang, "links", i, end="\r", flush=True)
    print(lang, sum(1 for v in out.values() if lang in v), flush=True)
json.dump(out, open(ROOT / "tools/facts/about.json", "w"), ensure_ascii=False, indent=1, sort_keys=True)
print("species with a description", len(out), "of", len(latins))
