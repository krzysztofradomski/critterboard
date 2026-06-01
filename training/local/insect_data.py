"""
Insect data for 20 common Central European species.

Data compiled from the following open sources:
  - iNaturalist (inaturalist.org)          — observations, range, taxonomy
  - Wikipedia English (en.wikipedia.org)   — species descriptions, ecology
  - GBIF (gbif.org)                        — taxonomy and occurrence data
  - Butterfly Conservation UK (butterfly-conservation.org) — butterfly ecology
  - Bumblebee Conservation Trust (bumblebeeconservation.org)
  - People's Trust for Endangered Species / PTES (ptes.org) — stag beetle
  - IUCN Red List (iucnredlist.org)        — conservation status
  - Buglife (buglife.org.uk)               — invertebrate fact sheets
  - European Environment Agency (eea.europa.eu) — European distribution data
"""

SPECIES_DATA = [
    {
        "taxon_id": 47219,
        "common_name": "Seven-spot Ladybird",
        "scientific_name": "Coccinella septempunctata",
        "order": "Coleoptera",
        "family": "Coccinellidae",
        "size_mm": "5–8",
        "wingspan_mm": None,
        "description": (
            "Europe's most familiar beetle: domed, glossy red elytra adorned with "
            "exactly seven black spots (three on each wing case, one shared at the "
            "centre). Both adults and larvae are voracious aphid predators and are "
            "widely used as biological-control agents."
        ),
        "habitat": "Gardens, meadows, agricultural fields, hedgerows, woodland edges.",
        "distribution": (
            "Throughout Europe from North Africa to the Arctic Circle; "
            "also widespread across Asia. One of the most abundant ladybirds in Europe."
        ),
        "diet": (
            "Carnivorous predator of aphids, scale insects, and other soft-bodied "
            "invertebrates. A single adult can consume up to 5,000 aphids during its "
            "lifetime."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Overwinters as a hibernating adult, often in large aggregations in leaf "
            "litter or under bark. When threatened, it exudes bitter-tasting yellow "
            "haemolymph (reflex bleeding) as a chemical defence."
        ),
        "identification_tips": (
            "Seven black spots on red/scarlet elytra. Smaller two-spot ladybird "
            "(Adalia bipunctata) has only two spots; the invasive Harlequin "
            "(Harmonia axyridis) is more variable."
        ),
        "interesting_facts": [
            "European good-luck symbol — associated with Virgin Mary in folk tradition.",
            "Can produce 'reflex bleeding': bright yellow haemolymph that tastes "
            "bitter to predators.",
            "Used commercially as a biocontrol agent in greenhouses across Europe.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/47219"},
            {"name": "Wikipedia — Coccinella septempunctata", "url": "https://en.wikipedia.org/wiki/Coccinella_septempunctata"},
            {"name": "GBIF — occurrence data", "url": "https://www.gbif.org/species/1045608"},
            {"name": "Buglife — Ladybird fact sheet", "url": "https://www.buglife.org.uk/bugs/bug-directory/seven-spot-ladybird/"},
        ],
    },
    {
        "taxon_id": 48484,
        "common_name": "Western Honey Bee",
        "scientific_name": "Apis mellifera",
        "order": "Hymenoptera",
        "family": "Apidae",
        "size_mm": "12–20",
        "wingspan_mm": None,
        "description": (
            "The world's most economically important pollinator, domesticated for "
            "honey production for at least 9,000 years. Workers are golden-brown "
            "with darker abdominal bands; queens are noticeably elongated. Colonies "
            "of 20,000–80,000 workers communicate through the famous 'waggle dance'."
        ),
        "habitat": "All habitats where flowering plants grow; nests in tree cavities, rock crevices, and managed hives.",
        "distribution": (
            "Native to Europe, Africa, and the Middle East; now present on every "
            "inhabited continent through human introduction."
        ),
        "diet": (
            "Nectar (converted to honey as winter stores) and pollen (protein for "
            "brood rearing). A colony may visit over 2 million flowers to produce "
            "500 g of honey."
        ),
        "conservation_status": "Data Deficient (wild populations declining across Europe)",
        "behavior": (
            "Eusocial; a single mated queen can live 5 years. Workers communicate "
            "foraging locations via the waggle dance, encoding direction and distance "
            "relative to the sun. Only female workers can sting; drones are stingless."
        ),
        "identification_tips": (
            "Stockier than wasps, with a distinctly hairy body that collects pollen. "
            "Brown/amber colouring, no sharp wasp-waist. Bumblebees are larger and "
            "more heavily furred."
        ),
        "interesting_facts": [
            "A single worker visits ~1,500 flowers per foraging trip.",
            "The waggle dance is one of the most complex animal communication systems "
            "outside primates (von Frisch Nobel Prize, 1973).",
            "Colony collapse disorder has reduced managed colony numbers by up to 30 % "
            "in some European countries since the mid-2000s.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/48484"},
            {"name": "Wikipedia — Apis mellifera", "url": "https://en.wikipedia.org/wiki/Western_honey_bee"},
            {"name": "GBIF — occurrence data", "url": "https://www.gbif.org/species/1341976"},
        ],
    },
    {
        "taxon_id": 52747,
        "common_name": "Common Brimstone",
        "scientific_name": "Gonepteryx rhamni",
        "order": "Lepidoptera",
        "family": "Pieridae",
        "size_mm": None,
        "wingspan_mm": "52–60",
        "description": (
            "A harbinger of spring: males are vivid sulphur-yellow, females pale "
            "greenish-white. The distinctive leaf-shaped wings with a small orange "
            "spot provide remarkable camouflage at rest. It is one of the longest-"
            "lived British butterflies, surviving up to 13 months."
        ),
        "habitat": "Woodland rides and clearings, hedgerows, scrub, gardens with buckthorn.",
        "distribution": (
            "Throughout Europe and temperate Asia east to China. Absent from "
            "northern Scotland and the far north of Scandinavia."
        ),
        "diet": (
            "Adults take nectar from a wide range of flowers, especially thistles "
            "and brambles. Caterpillars feed exclusively on buckthorn (Rhamnus "
            "cathartica) and alder buckthorn (Frangula alnus)."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Overwinters as an adult, sheltering in ivy and holly. Emerges on warm "
            "days from late January onward — often the first butterfly of the year "
            "in the UK. Males seek females actively in spring."
        ),
        "identification_tips": (
            "Unmistakable: males brilliant yellow, females greenish-white, both with "
            "leaf-like wing shape and one orange-centred spot per wing. Never shows "
            "the dark wingtips of Large White."
        ),
        "interesting_facts": [
            "The word 'butterfly' may derive from 'brimstone' — the butter-yellow "
            "colour of the male was the original 'butter fly'.",
            "Adults live up to 13 months, the longest of any British butterfly species.",
            "Females can match a dead leaf so well they are virtually invisible at rest.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/52747"},
            {"name": "Wikipedia — Gonepteryx rhamni", "url": "https://en.wikipedia.org/wiki/Brimstone_(butterfly)"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/brimstone"},
            {"name": "GBIF — occurrence data", "url": "https://www.gbif.org/species/1920504"},
        ],
    },
    {
        "taxon_id": 52775,
        "common_name": "Buff-tailed Bumblebee",
        "scientific_name": "Bombus terrestris",
        "order": "Hymenoptera",
        "family": "Apidae",
        "size_mm": "11–23",
        "wingspan_mm": None,
        "description": (
            "One of Europe's largest and most common bumblebees. Queens have a "
            "buff-yellow tail; workers have a white tail with a buff tinge; males "
            "have a yellow face and tail. A key pollinator of both wildflowers and "
            "agricultural crops."
        ),
        "habitat": "Gardens, meadows, farmland, heathland, woodland edges — almost anywhere with flowers.",
        "distribution": (
            "Throughout Europe from the Mediterranean to southern Scandinavia; "
            "commercially introduced to many parts of the world as a crop pollinator."
        ),
        "diet": (
            "Nectar and pollen from a wide variety of flowering plants. A generalist "
            "forager with a medium-length tongue. Colonies can forage over a 1.5 km "
            "radius."
        ),
        "conservation_status": "Least Concern (but declining in some regions)",
        "behavior": (
            "Nest underground, often in old rodent burrows. Annual cycle: mated queens "
            "overwinter alone; in spring she founds a new colony that grows to "
            "150–400 workers by late summer. Workers can 'buzz pollinate' by vibrating "
            "at ~400 Hz to release pollen from tomato flowers (sonication)."
        ),
        "identification_tips": (
            "Two yellow bands (one behind head, one on abdomen) and a buff/white tail. "
            "Queens noticeably larger than workers. Distinguish from Garden Bumblebee "
            "(Bombus hortorum) by shorter face and no yellow at thorax-abdomen join."
        ),
        "interesting_facts": [
            "The most widely commercialised bumblebee in the world — billions used "
            "annually in glasshouses for tomato and strawberry pollination.",
            "Sonication (buzz pollination) is essential for some crops: bees vibrate "
            "pollen free at a specific resonant frequency.",
            "Commercially bred colonies have been implicated in disease transmission "
            "to wild bumblebee populations where they have escaped.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/52775"},
            {"name": "Wikipedia — Bombus terrestris", "url": "https://en.wikipedia.org/wiki/Bombus_terrestris"},
            {"name": "Bumblebee Conservation Trust", "url": "https://www.bumblebeeconservation.org/bumblebees/identifying-bumblebees/buff-tailed-bumblebee/"},
            {"name": "GBIF — occurrence data", "url": "https://www.gbif.org/species/1341976"},
        ],
    },
    {
        "taxon_id": 57593,
        "common_name": "Peacock Butterfly",
        "scientific_name": "Aglais io",
        "order": "Lepidoptera",
        "family": "Nymphalidae",
        "size_mm": None,
        "wingspan_mm": "50–55",
        "description": (
            "One of Europe's most spectacular butterflies: deep burgundy wings "
            "bearing four large, vivid eyespots — one on each wing — that closely "
            "resemble the eyes of a large animal. The undersides are jet-black, "
            "providing camouflage when resting with wings closed."
        ),
        "habitat": "Gardens, meadows, woodland clearings, nettle patches.",
        "distribution": (
            "Throughout Europe and temperate Asia east to Japan. Common and "
            "widespread across lowland Britain and Ireland."
        ),
        "diet": (
            "Adults nectar on thistles, buddleia, hemp agrimony, and many garden "
            "flowers. Caterpillars feed gregariously on common nettle (Urtica dioica)."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Overwinters as a hibernating adult in outbuildings, hollow trees, and "
            "woodpiles. Emerges on warm days in late February or March. When "
            "threatened, it flashes its eyespots and produces a hissing sound by "
            "rubbing its wing veins together."
        ),
        "identification_tips": (
            "Unmistakable: the four large, boldly coloured eyespots on a deep red "
            "background are unique in Europe. At rest with wings closed, the dark "
            "undersides make it look like a dead leaf."
        ),
        "interesting_facts": [
            "Can produce an audible hissing sound by rubbing wing veins — one of "
            "very few butterflies to use acoustic defence.",
            "The caterpillars are black with white speckles and feed communally on "
            "nettles inside a silk tent.",
            "Has been successfully recolonising northern Scandinavia as temperatures "
            "warm, expanding its range northward.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/57593"},
            {"name": "Wikipedia — Aglais io", "url": "https://en.wikipedia.org/wiki/Peacock_butterfly"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/peacock"},
        ],
    },
    {
        "taxon_id": 55626,
        "common_name": "Large White Butterfly",
        "scientific_name": "Pieris brassicae",
        "order": "Lepidoptera",
        "family": "Pieridae",
        "size_mm": None,
        "wingspan_mm": "58–63",
        "description": (
            "A large, predominantly white butterfly with prominent black wingtip "
            "patches on the upper forewings. Females additionally have two black "
            "spots on each forewing. Caterpillars are yellow and black, and feed "
            "gregariously on brassicas — making this a significant agricultural pest."
        ),
        "habitat": "Gardens, allotments, farmland, roadsides, waste ground.",
        "distribution": (
            "Throughout Europe, North Africa, and across Asia to the Himalayas. "
            "A strong migrant that supplements resident populations annually."
        ),
        "diet": (
            "Caterpillars eat brassicas (cabbage, kale, mustard, nasturtium). "
            "Adults take nectar from a variety of flowers."
        ),
        "conservation_status": "Least Concern; very common",
        "behavior": (
            "Produces two or three broods per year in the UK. Caterpillars are "
            "aposematically coloured (warning coloration) and release mustard-oil "
            "glucosides as a chemical defence. Commonly parasitised by the "
            "braconid wasp Cotesia glomerata."
        ),
        "identification_tips": (
            "Large size and broad black wingtips distinguish it from the smaller "
            "Small White (Pieris rapae). Females have two spots on the forewing; "
            "males have none."
        ),
        "interesting_facts": [
            "A single female can lay up to 600 eggs in her lifetime.",
            "Cotesia glomerata wasps parasitise the caterpillars, eventually "
            "emerging from the live larva in a mass of yellow cocoons.",
            "A strong seasonal migrant: large influxes from continental Europe "
            "regularly supplement UK populations.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/55626"},
            {"name": "Wikipedia — Pieris brassicae", "url": "https://en.wikipedia.org/wiki/Large_white_butterfly"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/large-white"},
        ],
    },
    {
        "taxon_id": 57508,
        "common_name": "Red Admiral",
        "scientific_name": "Vanessa atalanta",
        "order": "Lepidoptera",
        "family": "Nymphalidae",
        "size_mm": None,
        "wingspan_mm": "64–78",
        "description": (
            "A boldly patterned butterfly with velvety black wings crossed by "
            "vivid red bands and white spots near the wingtips. The undersides "
            "are cryptic brown and grey, providing camouflage at rest. One of "
            "Europe's most familiar garden visitors in late summer and autumn."
        ),
        "habitat": "Gardens, woodland edges, coastal scrub, parks, orchards.",
        "distribution": (
            "Europe, North Africa, North America, the Canary Islands, and "
            "New Zealand. A strong migrant."
        ),
        "diet": (
            "Adults are especially attracted to rotting fruit, ivy flowers, and "
            "sap runs in autumn; also take nectar. Caterpillars feed on common "
            "nettles (Urtica dioica)."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Migratory, moving northward from North Africa and southern Europe "
            "each spring. In northern Europe it can partially hibernate in mild "
            "winters. Males are highly territorial, returning to the same sunny "
            "spot to bask each afternoon."
        ),
        "identification_tips": (
            "Unmistakable in Europe: striking red bands on black, with white spots "
            "near the forewing tip. No similar species in Europe."
        ),
        "interesting_facts": [
            "One of the last butterflies to be seen flying in autumn in the UK "
            "— sometimes into December on warm days.",
            "Males establish and defend warm, sunny basking territories vigorously.",
            "Has been recorded at altitudes over 3,000 m in the Alps during migration.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/57508"},
            {"name": "Wikipedia — Vanessa atalanta", "url": "https://en.wikipedia.org/wiki/Red_admiral"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/red-admiral"},
        ],
    },
    {
        "taxon_id": 57583,
        "common_name": "Small Tortoiseshell",
        "scientific_name": "Aglais urticae",
        "order": "Lepidoptera",
        "family": "Nymphalidae",
        "size_mm": None,
        "wingspan_mm": "45–62",
        "description": (
            "A familiar garden butterfly with rich orange-red wings scalloped "
            "with yellow and black patches, and a row of blue spots along the "
            "outer margins. The dull brown undersides camouflage it at rest. "
            "Closely linked to common nettles for breeding."
        ),
        "habitat": "Gardens, meadows, roadside nettle patches, farmland.",
        "distribution": (
            "Throughout Europe and temperate Asia. One of the most common "
            "butterflies across much of Europe, though declining in north-western "
            "Europe."
        ),
        "diet": (
            "Adults nectar on buddleia, thistles, and many garden flowers. "
            "Caterpillars feed gregariously on common nettle."
        ),
        "conservation_status": "Least Concern overall; significantly declining in parts of NW Europe",
        "behavior": (
            "Overwinters as adult, often entering houses and outbuildings. "
            "One of the first butterflies to emerge in spring. Produces two "
            "broods per year in most of Europe."
        ),
        "identification_tips": (
            "Distinguished from Peacock by the mixed orange, yellow, and black "
            "patterning without the large eyespots. Smaller than a Peacock; "
            "more irregular wing outline."
        ),
        "interesting_facts": [
            "Decline in the UK (c. 50% since the 1970s) may partly be caused by "
            "an introduced parasitic fly, Sturmia bella.",
            "Adults will bask on warm surfaces including human skin to thermoregulate.",
            "Females lay eggs in large batches of up to 100 on fresh nettle growth.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/57583"},
            {"name": "Wikipedia — Aglais urticae", "url": "https://en.wikipedia.org/wiki/Small_tortoiseshell"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/small-tortoiseshell"},
        ],
    },
    {
        "taxon_id": 57423,
        "common_name": "Small White Butterfly",
        "scientific_name": "Pieris rapae",
        "order": "Lepidoptera",
        "family": "Pieridae",
        "size_mm": None,
        "wingspan_mm": "46–54",
        "description": (
            "A small to medium white butterfly with subtle black or grey "
            "wingtip patches and one (males) or two (females) small dark spots "
            "on the forewing. One of the most abundant and widespread butterflies "
            "in the world after multiple accidental introductions."
        ),
        "habitat": "Gardens, farmland, roadsides, parks — virtually any open habitat.",
        "distribution": (
            "Native to Europe; now one of the world's most widespread butterflies "
            "following introductions to North America (1860s), Australia (1929), "
            "New Zealand (1930), and Hawaii (1949)."
        ),
        "diet": (
            "Caterpillars are solitary feeders on brassicas, nasturtium, and "
            "mignonette. Adults take nectar from many flowers."
        ),
        "conservation_status": "Least Concern; globally very common",
        "behavior": (
            "Produces 2–3 broods per year in the UK, up to 5 in the "
            "Mediterranean. A confirmed migrant in Europe. Caterpillars are "
            "individually cryptic green, unlike the conspicuous gregarious "
            "caterpillars of the Large White."
        ),
        "identification_tips": (
            "Smaller than Large White with less extensive and greyer (not black) "
            "wingtip markings. Forewing spots are grey-black on white ground. "
            "Small Whites are much more solitary feeders."
        ),
        "interesting_facts": [
            "The most successful butterfly introduction worldwide — now a "
            "significant agricultural pest on four continents.",
            "Caterpillars are coloured to match the grey-green of brassica "
            "leaves, unlike the bold warning colours of Large White larvae.",
            "A major study using radar tracking revealed Small Whites use a "
            "solar compass to navigate during migration.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/57423"},
            {"name": "Wikipedia — Pieris rapae", "url": "https://en.wikipedia.org/wiki/Small_white_butterfly"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/small-white"},
        ],
    },
    {
        "taxon_id": 48735,
        "common_name": "Common Wasp",
        "scientific_name": "Vespula vulgaris",
        "order": "Hymenoptera",
        "family": "Vespidae",
        "size_mm": "11–20",
        "wingspan_mm": None,
        "description": (
            "The quintessential 'wasp': bright yellow and black warning "
            "colouration, a narrow wasp waist, and a painful sting. While often "
            "regarded as a nuisance, colonies are important predators of pest "
            "insects and significant decomposers of woody material for nest "
            "building."
        ),
        "habitat": "Almost all terrestrial habitats; nests underground, in wall cavities, and in lofts.",
        "distribution": (
            "Throughout Europe and Asia; introduced to Australia and New Zealand "
            "where it is an invasive pest."
        ),
        "diet": (
            "Larvae are fed chewed insects (mainly flies and caterpillars). "
            "Adults eat nectar and ripe fruit; in late summer, workers are "
            "attracted to sweet food after the queen stops laying."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Annual colony founded by a single queen in spring; peaks at "
            "~5,000–10,000 workers in late summer. Workers are aggressive only "
            "near the nest. In autumn, the colony dies except for mated new "
            "queens that overwinter."
        ),
        "identification_tips": (
            "The parallel-sided yellow and black bands and hairless, shiny "
            "abdomen distinguish wasps from bees. The German Wasp (V. germanica) "
            "is virtually identical but has three black dots on the face plate "
            "(clypeus) instead of a central anchor/arrowhead mark."
        ),
        "interesting_facts": [
            "A single wasp colony kills and feeds an estimated 7 kg of caterpillars, "
            "flies, and other insects to its larvae over a season.",
            "Paper nests are constructed from chewed plant fibres mixed with "
            "saliva — effectively recycled wood pulp.",
            "Late-summer 'drunken' wasps are workers seeking sugar because the "
            "colony has stopped producing young to feed.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/48735"},
            {"name": "Wikipedia — Vespula vulgaris", "url": "https://en.wikipedia.org/wiki/Vespula_vulgaris"},
            {"name": "Buglife — Wasp fact sheet", "url": "https://www.buglife.org.uk/bugs/bug-directory/common-wasp/"},
        ],
    },
    {
        "taxon_id": 61585,
        "common_name": "Stag Beetle",
        "scientific_name": "Lucanus cervus",
        "order": "Coleoptera",
        "family": "Lucanidae",
        "size_mm": "25–75",
        "wingspan_mm": None,
        "description": (
            "The UK's largest beetle and one of Europe's most impressive insects. "
            "Males have hugely enlarged mandibles ('antlers') used in wrestling "
            "contests over females. The reddish-brown elytra contrast with the "
            "jet-black head and thorax. Larvae live underground in decaying "
            "oak and other hardwood roots for 3–7 years."
        ),
        "habitat": "Deciduous woodland, ancient parkland, gardens, and hedgerows with old trees.",
        "distribution": (
            "Central and southern Europe, with strongholds in England (especially "
            "south-east), France, Germany, Italy, and the Iberian Peninsula. "
            "Rare and absent from much of northern Europe."
        ),
        "diet": (
            "Larvae: decaying hardwood roots (especially oak), consuming almost "
            "nothing as adults. Adults: tree sap and fermenting fruit juices "
            "during their brief (4–8 week) adult life."
        ),
        "conservation_status": "Near Threatened (IUCN); protected in the UK and listed on EU Habitats Directive Annex II",
        "behavior": (
            "Nocturnal fliers from late May to August. Males clash antlers in "
            "jousting tournaments, gripping rivals and attempting to overturn "
            "them. Flight is lumbering and audible. Females lay eggs in rotting "
            "wood at the base of old trees."
        ),
        "identification_tips": (
            "Males unmistakable: huge orange-brown 'antler' mandibles on a large "
            "black-and-brown beetle 35–75 mm long. Females lack enlarged mandibles "
            "and are more uniform dark brown, 30–50 mm."
        ),
        "interesting_facts": [
            "Larvae can spend up to 7 years underground before pupating.",
            "Listed in Annex II of the EU Habitats Directive — governments must "
            "designate Special Areas of Conservation for the species.",
            "Population declines linked to loss of veteran and dead wood; "
            "leaving log piles in gardens is a key conservation action.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/61585"},
            {"name": "Wikipedia — Lucanus cervus", "url": "https://en.wikipedia.org/wiki/Lucanus_cervus"},
            {"name": "People's Trust for Endangered Species — Great Stag Hunt", "url": "https://ptes.org/campaigns/great-stag-hunt/"},
            {"name": "IUCN Red List", "url": "https://www.iucnredlist.org/species/41190/10417567"},
        ],
    },
    {
        "taxon_id": 119870,
        "common_name": "Green Shield Bug",
        "scientific_name": "Palomena prasina",
        "order": "Hemiptera",
        "family": "Pentatomidae",
        "size_mm": "12–14",
        "wingspan_mm": None,
        "description": (
            "A bright green, shield-shaped bug with a tiny dark triangle "
            "(scutellum) at the centre of the back. In autumn it turns bronze-"
            "brown before overwintering, providing remarkable seasonal camouflage. "
            "Like all shield bugs, it can release a pungent defensive odour."
        ),
        "habitat": "Hedgerows, woodland edges, gardens, scrub with hazel, bramble, and other shrubs.",
        "distribution": (
            "Throughout Europe from the Mediterranean to southern Scandinavia; "
            "east to Japan."
        ),
        "diet": (
            "Piercing mouthparts used to extract plant sap and juices from "
            "seeds, fruit, and soft plant tissue of a wide range of shrubs and "
            "herbaceous plants."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Overwinters as adult under bark or in leaf litter, changing colour "
            "to dark bronze-brown. Returns to bright green in spring. Nymphs are "
            "initially brightly coloured before developing adult green colouring "
            "through several moults."
        ),
        "identification_tips": (
            "Typical shield shape and uniform bright green make it easy to "
            "identify in summer. The similar Hawthorn Shield Bug "
            "(Acanthosoma haemorrhoidale) has red/orange on the wings."
        ),
        "interesting_facts": [
            "Changes from bright green to dark bronze for its overwintering phase "
            "— a dramatic seasonal colour change unique in European bugs.",
            "Belongs to the 'stink bug' superfamily and can produce a characteristic "
            "pungent smell from glands on the thorax when disturbed.",
            "Nymphs are strikingly black and green, quite unlike the adults.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/119870"},
            {"name": "Wikipedia — Palomena prasina", "url": "https://en.wikipedia.org/wiki/Palomena_prasina"},
            {"name": "Buglife — Shield Bug guide", "url": "https://www.buglife.org.uk/bugs/bug-directory/green-shieldbug/"},
        ],
    },
    {
        "taxon_id": 56057,
        "common_name": "Common Blue Damselfly",
        "scientific_name": "Enallagma cyathigerum",
        "order": "Odonata",
        "family": "Coenagrionidae",
        "size_mm": "29–36",
        "wingspan_mm": "36–48",
        "description": (
            "The most abundant and widespread damselfly in Europe. Males are "
            "electric blue with black patterning; females are blue or dull green. "
            "Like all Odonata they are fast aerial predators and have aquatic "
            "larvae. Distinguished from the similar Azure Damselfly by the "
            "mushroom-shaped mark (not a goblet) on abdominal segment 2."
        ),
        "habitat": "Still and slow-moving freshwater: ponds, lakes, reservoirs, canals, ditches.",
        "distribution": (
            "Throughout Europe and across the Palearctic to the Pacific. "
            "Highly abundant wherever suitable standing water exists."
        ),
        "diet": (
            "Adults catch gnats, midges, and other small flying insects on "
            "the wing. Aquatic nymphs (larvae) are ambush predators of water "
            "fleas, worms, and small aquatic invertebrates."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Males patrol and defend territories over water. Pairs mate in the "
            "'wheel position' and fly in tandem during egg-laying. Aquatic "
            "larvae live for 1–2 years before emerging as adults."
        ),
        "identification_tips": (
            "Males: pale blue with black marks. The key feature is the segment 2 "
            "marking: a 'mushroom' or 'lollipop' shape rather than the 'goblet' "
            "of the Azure Damselfly (Coenagrion puella)."
        ),
        "interesting_facts": [
            "Odonata is one of the most ancient insect orders — dragonflies and "
            "damselflies have existed for over 325 million years.",
            "The larva uses a modified extendable lower lip (labium) to catch prey "
            "at close range — one of the fastest strike mechanisms in the animal kingdom.",
            "Pairs fly in tandem during egg-laying, with the female inserting eggs "
            "into aquatic plant stems.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/56057"},
            {"name": "Wikipedia — Enallagma cyathigerum", "url": "https://en.wikipedia.org/wiki/Common_blue_damselfly"},
            {"name": "British Dragonfly Society", "url": "https://www.british-dragonflies.org.uk/species/common-blue-damselfly/"},
        ],
    },
    {
        "taxon_id": 61525,
        "common_name": "Rose Chafer",
        "scientific_name": "Cetonia aurata",
        "order": "Coleoptera",
        "family": "Cetoniidae",
        "size_mm": "14–20",
        "wingspan_mm": None,
        "description": (
            "A strikingly beautiful beetle with iridescent golden-green elytra "
            "marked with irregular white streaks. Unlike most beetles, it can "
            "fly with its wing cases (elytra) closed, making it one of the most "
            "agile flying beetles in Europe. A frequent visitor to open flowers "
            "in summer."
        ),
        "habitat": "Gardens, meadows, woodland edges; adults especially associated with wild roses, elderflower, and umbellifers.",
        "distribution": "Throughout Europe from the UK and North Africa to western Iran.",
        "diet": (
            "Adults eat pollen, nectar, and ripe fruit. Larvae (C-shaped white "
            "grubs) feed on decaying wood and humus in compost heaps, log piles, "
            "and old trees for 2–3 years."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Day-flying; active in warm sunshine from May to September. Unusually "
            "for a beetle, it tucks its wings beneath the elytra and flies with "
            "the elytra closed via notches at the elytra's sides."
        ),
        "identification_tips": (
            "Distinctive iridescent green/golden colour with white flecks on "
            "elytra. The Bronze Chafer (Protaetia cuprea) is similar but more "
            "bronze-toned and tends to be in drier habitats."
        ),
        "interesting_facts": [
            "One of only a handful of beetles that can fly with wing cases closed "
            "— special lateral notches allow the membranous hindwings to extend "
            "without lifting the elytra.",
            "Larvae are frequently found in garden compost heaps; gardeners "
            "sometimes mistake them for pest cockchafer larvae.",
            "The iridescent green colouration is structural (not pigment), caused "
            "by layers of chitin reflecting specific wavelengths of light.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/61525"},
            {"name": "Wikipedia — Cetonia aurata", "url": "https://en.wikipedia.org/wiki/Cetonia_aurata"},
        ],
    },
    {
        "taxon_id": 52798,
        "common_name": "Orange Tip",
        "scientific_name": "Anthocharis cardamines",
        "order": "Lepidoptera",
        "family": "Pieridae",
        "size_mm": None,
        "wingspan_mm": "46–52",
        "description": (
            "A distinctive spring butterfly: males have white forewings with "
            "vivid orange tips that are unmistakable, while females lack the "
            "orange and can be confused with other white butterflies. Both sexes "
            "have mottled green marbling on the hindwing underside that provides "
            "camouflage among garlic-mustard flowers."
        ),
        "habitat": "Damp meadows, woodland rides, hedgerows, riverbanks with cuckooflower and garlic mustard.",
        "distribution": (
            "Throughout Europe and across temperate Asia. In the UK, found across "
            "most of England, Wales, and southern Scotland."
        ),
        "diet": (
            "Caterpillars feed on cuckooflower (Cardamine pratensis) and garlic "
            "mustard (Alliaria petiolata). Adults take nectar, especially from "
            "their foodplants and bluebell."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Single-brooded; flying April–June. Adults are short-lived (2–3 weeks). "
            "Caterpillars can be cannibalistic — they mimic seed pods of their "
            "foodplant to avoid being eaten by other caterpillars."
        ),
        "identification_tips": (
            "Males: unmistakable bright orange wingtips on white. Females: white "
            "with grey wingtip dusting and distinctive green underside mottling "
            "(visible at rest)."
        ),
        "interesting_facts": [
            "One of the earliest spring butterflies — its emergence marks a "
            "traditional sign that spring has arrived in the UK.",
            "The orange pigment in male wings is derived from flavonoids in the "
            "caterpillar's foodplant.",
            "The caterpillar's elongated green body mimics a seed pod of garlic "
            "mustard so convincingly that it deters both predators and rival "
            "caterpillars.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/52798"},
            {"name": "Wikipedia — Anthocharis cardamines", "url": "https://en.wikipedia.org/wiki/Orange_tip"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/orange-tip"},
        ],
    },
    {
        "taxon_id": 57486,
        "common_name": "Painted Lady",
        "scientific_name": "Vanessa cardui",
        "order": "Lepidoptera",
        "family": "Nymphalidae",
        "size_mm": None,
        "wingspan_mm": "58–74",
        "description": (
            "The world's most widespread butterfly, found on every continent "
            "except Antarctica and South America. Wings are salmon-orange with "
            "black and white patterning and five distinctive white spots near "
            "each forewing tip. Annual migrations from sub-Saharan Africa cover "
            "up to 15,000 km across multiple generations."
        ),
        "habitat": "Open habitats everywhere: meadows, gardens, coastal dunes, mountains, and deserts.",
        "distribution": (
            "Virtually cosmopolitan; regular summer visitor across all of Europe "
            "migrating north from its breeding grounds in North Africa."
        ),
        "diet": (
            "Adults nectar on thistles, knapweed, buddleia, and many other "
            "flowers. Caterpillars feed mainly on thistles (Cirsium, Carduus), "
            "mallows (Malva), and nettles."
        ),
        "conservation_status": "Least Concern",
        "behavior": (
            "Entirely migratory in Europe — no permanent resident populations. "
            "The multi-generational migration from Africa to the Arctic Circle "
            "and back involves up to six butterfly generations and uses "
            "high-altitude jet streams for assisted travel."
        ),
        "identification_tips": (
            "Salmon-pink/orange with complex black and white patterning. More "
            "uniformly patterned than Red Admiral. The American Painted Lady "
            "(V. virginiensis) is similar but has two large eyespots on the "
            "hindwing underside."
        ),
        "interesting_facts": [
            "A 2019 Science study proved the complete 15,000+ km round-trip "
            "migration using hydrogen isotopes in butterfly wings.",
            "Individuals use high-altitude wind assistance at 1,000–3,000 m, "
            "sometimes detected by radar.",
            "Caterpillars weave individual silk tents on thistles — unlike the "
            "gregarious tent-building of many other Nymphalidae.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/57486"},
            {"name": "Wikipedia — Vanessa cardui", "url": "https://en.wikipedia.org/wiki/Painted_lady_(butterfly)"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/painted-lady"},
            {"name": "Science (2019) — migration study", "url": "https://www.science.org/doi/10.1126/science.aay2926"},
        ],
    },
    {
        "taxon_id": 48745,
        "common_name": "European Hornet",
        "scientific_name": "Vespa crabro",
        "order": "Hymenoptera",
        "family": "Vespidae",
        "size_mm": "18–35",
        "wingspan_mm": None,
        "description": (
            "Europe's largest native wasp: queens reach 35 mm. Distinguished "
            "from common wasps by its larger size, brown and yellow (not stark "
            "black and yellow) colouration, and rounded, not pointed, abdomen. "
            "Despite its fearsome reputation, it is generally less aggressive "
            "than smaller wasps when not guarding its nest."
        ),
        "habitat": "Woodland edges, orchards, parks, gardens near deciduous trees; nests in hollow trees and wall cavities.",
        "distribution": (
            "Throughout Europe eastward to eastern Russia and China; introduced "
            "to North America (first recorded 1840s)."
        ),
        "diet": (
            "Hunts large insects including other wasps, dragonflies, beetles, "
            "and even honey bees for larval food. Adults also eat nectar, fruit "
            "juice, and tree sap."
        ),
        "conservation_status": "Least Concern; legally protected in Germany and some other EU states",
        "behavior": (
            "Annual colony of 200–1,000 workers. Unique among European wasps in "
            "its nocturnal foraging activity, attracted to artificial lights. "
            "Can strip bark from trees to feed on sap."
        ),
        "identification_tips": (
            "Much larger than a common wasp (compare size), brownish-red on head "
            "and thorax, yellow and brown abdomen. The Asian Hornet "
            "(Vespa velutina), an invasive species, is darker with a yellow "
            "fourth abdominal segment."
        ),
        "interesting_facts": [
            "Unlike other Vespula wasps, hornets are active at night and are "
            "commonly attracted to outdoor lights in summer.",
            "Legally protected in Germany — it is illegal to destroy a nest "
            "without a permit.",
            "Sting venom is no stronger per ml than a common wasp, but hornets "
            "can sting repeatedly and deliver more venom.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/48745"},
            {"name": "Wikipedia — Vespa crabro", "url": "https://en.wikipedia.org/wiki/European_hornet"},
        ],
    },
    {
        "taxon_id": 52786,
        "common_name": "Common Swallowtail",
        "scientific_name": "Papilio machaon",
        "order": "Lepidoptera",
        "family": "Papilionidae",
        "size_mm": None,
        "wingspan_mm": "65–86",
        "description": (
            "One of Europe's largest and most spectacular butterflies. Pale "
            "yellow wings with intricate black patterning, bold blue hindwing "
            "patches, and distinctive 'tails' on the hindwings. The British race "
            "(P. m. britannicus) is restricted to the Norfolk Broads; continental "
            "European populations are more widespread."
        ),
        "habitat": "Chalk grassland, open meadows, wetland margins, and fen (UK race). Mountain valleys and open country on the Continent.",
        "distribution": (
            "Widespread across Europe (excluding Scotland and Ireland), "
            "temperate Asia, and North America. In the UK, restricted to "
            "Norfolk Broads as a breeding species."
        ),
        "diet": (
            "Caterpillars feed on umbellifers: milk-parsley (Thyselinum palustre) "
            "in the UK; fennel, carrot, and wild parsley on the Continent. "
            "Adults take nectar from thistles, ragged robin, and other flowers."
        ),
        "conservation_status": "Least Concern overall; British race is a priority conservation species",
        "behavior": (
            "Males 'hilltopping' — gathering on prominent features to find mates. "
            "Caterpillars possess an osmeterium: a brightly coloured, fork-shaped "
            "organ behind the head that emits a strong odour when threatened."
        ),
        "identification_tips": (
            "Large size and distinctive hindwing tails are unmistakable in Europe. "
            "The Scarce Swallowtail (Iphiclides podalirius) has similar tails but "
            "a very different stripe pattern."
        ),
        "interesting_facts": [
            "The osmeterium (the caterpillar's 'snake tongue') releases a scent "
            "resembling rancid butter and is thought to deter parasitic flies.",
            "The UK race (britannicus) has shown signs of expanding due to climate "
            "change — occasionally seen outside Norfolk.",
            "Considered a flagship species for fen and wetland conservation in Britain.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/52786"},
            {"name": "Wikipedia — Papilio machaon", "url": "https://en.wikipedia.org/wiki/Papilio_machaon"},
            {"name": "Butterfly Conservation UK", "url": "https://butterfly-conservation.org/butterflies/swallowtail"},
        ],
    },
    {
        "taxon_id": 60827,
        "common_name": "Harlequin Ladybird",
        "scientific_name": "Harmonia axyridis",
        "order": "Coleoptera",
        "family": "Coccinellidae",
        "size_mm": "5.5–8.5",
        "wingspan_mm": None,
        "description": (
            "Originally from Asia, now one of the world's most invasive insects. "
            "Highly variable: over 100 colour forms recorded, ranging from orange "
            "with black spots to black with red spots. Generally larger and more "
            "domed than the Seven-spot Ladybird. Its invasion of Europe is "
            "threatening native ladybird populations."
        ),
        "habitat": "Gardens, woodland, farmland — virtually any habitat with aphids or soft-bodied prey.",
        "distribution": (
            "Native to eastern Asia; deliberately introduced to Europe and North "
            "America as biocontrol for aphids; now invasive across most of Europe."
        ),
        "diet": (
            "Highly aggressive and generalist predator: aphids, scale insects, "
            "moth eggs, butterfly and moth larvae, and critically, native "
            "ladybird larvae, eggs, and pupae."
        ),
        "conservation_status": "Not threatened; listed as a species of concern for its impact on native biodiversity",
        "behavior": (
            "Forms large overwintering aggregations in buildings, often returning "
            "to the same sites year after year. Can emit an unpleasant defensive "
            "odour. Females lay more eggs than native ladybirds and have a longer "
            "breeding season."
        ),
        "identification_tips": (
            "Highly variable; the most reliable identification feature is the "
            "white 'M' or 'W' shaped mark on the pronotum (white area behind "
            "the head). Larger than Seven-spot; rounder. Many colour forms."
        ),
        "interesting_facts": [
            "Carries the microsporidian parasite Nosema adaliae, which is lethal "
            "to native ladybirds but not to Harlequins — a biological weapon "
            "advantage.",
            "Introduced to Europe from the 1980s as a biocontrol agent; by 2004 "
            "wild populations were establishing across the continent.",
            "Over 100 different colour and spot-number forms have been documented "
            "— one of the most polymorphic insects in Europe.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/60827"},
            {"name": "Wikipedia — Harmonia axyridis", "url": "https://en.wikipedia.org/wiki/Harmonia_axyridis"},
            {"name": "Harlequin Ladybird Survey (UK)", "url": "https://www.harlequin-survey.org/"},
            {"name": "GBIF — invasion tracking", "url": "https://www.gbif.org/species/1045631"},
        ],
    },
    {
        "taxon_id": 48480,
        "common_name": "Garden Bumblebee",
        "scientific_name": "Bombus hortorum",
        "order": "Hymenoptera",
        "family": "Apidae",
        "size_mm": "11–22",
        "wingspan_mm": None,
        "description": (
            "A medium-sized bumblebee with the longest tongue of any European "
            "bumblebee species, allowing it to exploit deep-tubed flowers "
            "inaccessible to other bees. Colouration: two yellow bands on the "
            "thorax, one on the abdomen, and a white tail. The face is "
            "distinctively long compared to other bumblebees."
        ),
        "habitat": "Gardens, hedgerows, farmland with clover, heathland, and woodland edges.",
        "distribution": (
            "Throughout Europe from Iceland and the Arctic to the Mediterranean; "
            "one of the few bumblebees found across the whole of the British Isles."
        ),
        "diet": (
            "Nectar and pollen, with a strong preference for deep-tubed flowers: "
            "foxglove, red clover, comfrey, honeysuckle, and white dead-nettle. "
            "An important long-distance pollen transporter."
        ),
        "conservation_status": "Least Concern, though declining in intensively farmed areas",
        "behavior": (
            "Annual colony; queens emerge in early spring and nest underground. "
            "Workers produce a distinctive 'roaring' sound when alarmed. Queens "
            "are often the first large bumblebee seen visiting snowdrops and "
            "crocuses in February."
        ),
        "identification_tips": (
            "Two yellow bands on thorax, one on abdomen, white tail, distinctly "
            "long face. Compare to Buff-tailed Bumblebee (shorter face, buff tail "
            "in queens) and White-tailed Bumblebee (Bombus lucorum — cleaner "
            "white tail, one thorax band)."
        ),
        "interesting_facts": [
            "Has the longest tongue relative to body size of any European bumblebee "
            "— essential for accessing red clover (a key agricultural crop).",
            "One of the only bumblebees that regularly visits foxglove (Digitalis) "
            "flowers, crawling deep inside.",
            "Crucial for pollinating broad beans and runner beans in UK allotments "
            "— a key food-security pollinator.",
        ],
        "sources": [
            {"name": "iNaturalist — taxon page", "url": "https://www.inaturalist.org/taxa/48480"},
            {"name": "Wikipedia — Bombus hortorum", "url": "https://en.wikipedia.org/wiki/Bombus_hortorum"},
            {"name": "Bumblebee Conservation Trust", "url": "https://www.bumblebeeconservation.org/bumblebees/identifying-bumblebees/garden-bumblebee/"},
        ],
    },
]

# ── Fast lookup helpers ────────────────────────────────────────────────────────

SPECIES_BY_TAXON_ID: dict[int, dict] = {s["taxon_id"]: s for s in SPECIES_DATA}

SPECIES_BY_SCIENTIFIC: dict[str, dict] = {
    s["scientific_name"]: s for s in SPECIES_DATA
}

SPECIES_BY_COMMON: dict[str, dict] = {
    s["common_name"]: s for s in SPECIES_DATA
}

# Map used during training — keyed by the folder name used in data/images/<taxon_id>/
TAXON_ID_TO_LABEL: dict[int, str] = {
    s["taxon_id"]: s["scientific_name"] for s in SPECIES_DATA
}


def get_by_label(label: str) -> dict | None:
    """
    Return species dict for a label string.
    Accepts scientific name, common name, or taxon_id string.
    """
    if label in SPECIES_BY_SCIENTIFIC:
        return SPECIES_BY_SCIENTIFIC[label]
    if label in SPECIES_BY_COMMON:
        return SPECIES_BY_COMMON[label]
    try:
        return SPECIES_BY_TAXON_ID.get(int(label))
    except (ValueError, TypeError):
        return None
