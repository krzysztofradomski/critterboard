"""Merge taxonomy (taxa.json), sizes (wiki_en.json) and rule-based habitat/diet into packs/eu-ce.json.

Each pack species gets `facts`: {o: order, fa: family, h: habitat key, d: diet key,
sz: [lo_mm, hi_mm], k: 'l'|'w' (length|wingspan), r: [GBIF regions]}. Habitat and diet are
*typical for the family/order* (rules below), not species-specific research; size comes from
the English Wikipedia text and range from GBIF record counts. The pack version is bumped.
Run after fetch_taxonomy.py and fetch_wiki.py: python3 tools/facts/build_facts.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
taxa = json.load(open(ROOT / "tools/facts/taxa.json"))
wiki = json.load(open(ROOT / "tools/facts/wiki_en.json"))
pack = json.load(open(ROOT / "packs/eu-ce.json"))

AQUATIC_HEMIPTERA = {"Notonectidae", "Corixidae", "Nepidae", "Gerridae", "Naucoridae", "Pleidae", "Veliidae", "Hydrometridae"}
PRED_HEMIPTERA = {"Reduviidae", "Nabidae", "Anthocoridae", "Notonectidae", "Nepidae", "Gerridae", "Naucoridae"}
BEES = {"Apidae", "Andrenidae", "Megachilidae", "Halictidae", "Colletidae", "Melittidae"}
PARASITOID_HYM = {"Ichneumonidae", "Braconidae", "Chalcididae", "Pompilidae", "Sphecidae", "Crabronidae", "Ichneumonoidea", "Scoliidae", "Tiphiidae"}

def diet(order, fam):
    if order == "Lepidoptera": return "lepi"
    if order == "Odonata": return "predator_flying"
    if order == "Orthoptera": return "grass" if fam == "Acrididae" else "plants_insects"
    if order == "Araneae": return "spiders"
    if order == "Opiliones": return "harvestman"
    if order == "Mantodea": return "predator"
    if order in ("Blattodea", "Dermaptera", "Psocodea", "Zygentoma"): return "detritus"
    if order == "Neuroptera": return "predator"
    if order == "Mecoptera": return "scavenge"
    if order == "Trombidiformes": return "sap"
    if order in ("Trichoptera", "Ephemeroptera"): return "nonfeeding"
    if order == "Ixodida": return "blood"
    if order == "Coleoptera":
        if fam == "Coccinellidae": return "aphid_eaters"
        if fam in ("Carabidae", "Staphylinidae", "Cantharidae", "Cleridae"): return "predator"
        if fam in ("Cerambycidae", "Lucanidae", "Buprestidae"): return "wood"
        if fam in ("Chrysomelidae", "Curculionidae"): return "leaves"
        if fam in ("Scarabaeidae", "Geotrupidae"): return "beetle_mixed"
        if fam in ("Oedemeridae", "Meloidae"): return "pollen"
        if fam == "Tenebrionidae": return "detritus"
        return "varied"
    if order == "Hemiptera": return "predator" if fam in PRED_HEMIPTERA else "sap"
    if order == "Hymenoptera":
        if fam in BEES: return "nectar_pollen"
        if fam == "Vespidae": return "wasp"
        if fam == "Formicidae": return "omnivore_ant"
        if fam == "Cynipidae": return "gall"
        if fam in PARASITOID_HYM: return "parasitoid"
        if fam == "Tenthredinidae": return "leaves"
        return "varied"
    if order == "Diptera":
        if fam == "Syrphidae": return "hoverfly"
        if fam in ("Tachinidae", "Bombyliidae"): return "parasitoid"
        if fam == "Asilidae": return "predator"
        return "varied"
    return "varied"

def habitat(order, fam):
    if order == "Odonata" or order in ("Trichoptera", "Ephemeroptera"): return "water"
    if order == "Orthoptera": return "grassland"
    if order == "Araneae": return "vegetation"
    if order in ("Opiliones", "Blattodea"): return "leaflitter"
    if order == "Mantodea": return "dry_sunny"
    if order in ("Dermaptera", "Psocodea", "Zygentoma"): return "crevices"
    if order == "Neuroptera": return "vegetation"
    if order == "Mecoptera": return "damp_woods"
    if order == "Ixodida": return "ground"
    if order == "Coleoptera":
        if fam in ("Cerambycidae", "Lucanidae", "Buprestidae"): return "deadwood"
        if fam in ("Carabidae", "Staphylinidae", "Tenebrionidae", "Geotrupidae", "Scarabaeidae"): return "ground"
        return "flowery"
    if order == "Hemiptera": return "water" if fam in AQUATIC_HEMIPTERA else "plants"
    if order == "Hymenoptera": return "ground" if fam == "Formicidae" else "flowery"
    return "flowery"

n = 0
for b in pack["bugs"]:
    t = taxa.get(b["latin"]) or {}
    w = wiki.get(b["latin"]) or {}
    order, fam = t.get("order"), t.get("family")
    f = {}
    if order: f["o"] = order
    if fam: f["fa"] = fam
    if order:
        f["h"], f["d"] = habitat(order, fam), diet(order, fam)
    sz = w.get("size_mm")
    if sz and sz[0] >= 1.5:  # drops eggs/larvae mis-read as the adult
        f["sz"], f["k"] = sz, "w" if w.get("kind") == "wingspan" else "l"
    if t.get("continents"): f["r"] = t["continents"]
    if f:
        b["facts"] = f
        n += 1
    else:
        b.pop("facts", None)
pack["version"] += 1
json.dump(pack, open(ROOT / "packs/eu-ce.json", "w"), ensure_ascii=False, indent=2)
print("species with facts", n, "size", sum(1 for b in pack["bugs"] if "sz" in b.get("facts", {})), "version", pack["version"])
