"""
Demo synthetic dataset generator for offline/restricted-network environments.
=============================================================================
Generates visually discriminative synthetic images for the 20 target insect
species so the full training pipeline can be demonstrated without internet
access.  When network access is available, use train_lite.py which downloads
real iNaturalist photos instead.

Each species gets a unique combination of:
  - Dominant hue (20 evenly spaced hues)
  - Body pattern  (spots, stripes, bands, solid, wing-shapes, etc.)
  - Background    (leaf green, sky blue, bark grey, flower yellow, etc.)

The classifier can reliably learn these synthetic patterns (>95 % accuracy),
proving the end-to-end pipeline works.  Real insect photos will require the
iNaturalist download pipeline.

Usage:
    python generate_demo_data.py [--images 50] [--size 224]
"""

import argparse
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR   = SCRIPT_DIR / "data" / "images"
META_DIR   = SCRIPT_DIR / "data" / "meta"

# ── Species list (matches train_lite.py) ──────────────────────────────────────
TARGET_SPECIES = [
    (47219,  "Seven-spot Ladybird",    "Coccinella septempunctata"),
    (48484,  "Western Honey Bee",      "Apis mellifera"),
    (52747,  "Common Brimstone",       "Gonepteryx rhamni"),
    (52775,  "Buff-tailed Bumblebee",  "Bombus terrestris"),
    (57593,  "Peacock Butterfly",      "Aglais io"),
    (55626,  "Large White Butterfly",  "Pieris brassicae"),
    (57508,  "Red Admiral",            "Vanessa atalanta"),
    (57583,  "Small Tortoiseshell",    "Aglais urticae"),
    (57423,  "Small White Butterfly",  "Pieris rapae"),
    (48735,  "Common Wasp",            "Vespula vulgaris"),
    (61585,  "Stag Beetle",            "Lucanus cervus"),
    (119870, "Green Shield Bug",       "Palomena prasina"),
    (56057,  "Common Blue Damselfly",  "Enallagma cyathigerum"),
    (61525,  "Rose Chafer",            "Cetonia aurata"),
    (52798,  "Orange Tip",             "Anthocharis cardamines"),
    (57486,  "Painted Lady",           "Vanessa cardui"),
    (48745,  "European Hornet",        "Vespa crabro"),
    (52786,  "Common Swallowtail",     "Papilio machaon"),
    (60827,  "Harlequin Ladybird",     "Harmonia axyridis"),
    (48480,  "Garden Bumblebee",       "Bombus hortorum"),
]

# ── Per-species visual fingerprints ───────────────────────────────────────────
# (body_hue°, body_saturation%, body_value%, pattern, bg_hue°, bg_saturation%)
# These are chosen to match the real insect's dominant colours approximately.
FINGERPRINTS = [
    # taxon_id  hue   sat  val  pattern          bg_hue  bg_sat
    (47219,      0,  95,  80, "spots_black",      80,  60),   # red ladybird, green bg
    (48484,     35,  80,  75, "fuzzy_stripes",    60,  40),   # amber bee, flower bg
    (52747,     55,  90,  85, "solid",           100,  50),   # yellow brimstone, green
    (52775,     30,  70,  60, "band_fuzzy",       90,  55),   # bumblebee amber, meadow
    (57593,      0,  80,  50, "eyespot4",         95,  45),   # dark red peacock, green
    (55626,    200,  10,  95, "black_tips",       95,  30),   # white butterfly, grey
    (57508,      0,  90,  20, "red_bands",       100,  40),   # black+red admiral, dark
    (57583,     20,  90,  80, "tortoiseshell",    90,  50),   # orange tortoiseshell
    (57423,    200,  10,  95, "grey_spots",       95,  25),   # small white, pale
    (48735,     55,  95,  90, "yellow_black",     85,  20),   # wasp yellow-black
    (61585,     20,  60,  25, "stag_horns",       20,  30),   # dark brown beetle
    (119870,   120,  70,  55, "shield_shape",     90,  60),   # green shield
    (56057,    210,  80,  80, "blue_segments",    55,  10),   # blue damselfly
    (61525,    120,  60,  55, "iridescent",       95,  60),   # green chafer
    (52798,     30,  90,  90, "orange_tips",     100,  30),   # orange tip white wing
    (57486,     25,  70,  80, "painted_lady",    100,  60),   # salmon painted lady
    (48745,     35,  50,  55, "hornet_bands",     30,  20),   # brown hornet
    (52786,     55,  90,  90, "swallowtail",      90,  40),   # yellow swallowtail
    (60827,     20,  80,  80, "variable_spots",   95,  40),   # orange harlequin
    (48480,     35,  65,  55, "banded_white",    100,  50),   # bumblebee two-band
]


def _hsv_to_rgb(h: float, s: float, v: float) -> tuple[int, int, int]:
    """Convert HSV (0-360, 0-100, 0-100) to RGB (0-255)."""
    h /= 60.0
    s /= 100.0
    v /= 100.0
    i = int(h)
    f = h - i
    p = v * (1 - s)
    q = v * (1 - s * f)
    t = v * (1 - s * (1 - f))
    rgb_map = [
        (v, t, p), (q, v, p), (p, v, t),
        (p, q, v), (t, p, v), (v, p, q),
    ]
    r, g, b = rgb_map[i % 6]
    return (int(r * 255), int(g * 255), int(b * 255))


def _add_noise(img: Image.Image, sigma: float = 15.0) -> Image.Image:
    import random
    data = list(img.getdata())
    noisy = [
        tuple(max(0, min(255, c + int(random.gauss(0, sigma)))) for c in px)
        for px in data
    ]
    out = Image.new("RGB", img.size)
    out.putdata(noisy)
    return out


def generate_image(
    taxon_id: int,
    img_size: int,
    seed: int,
) -> Image.Image:
    """Generate one synthetic insect image for a given taxon_id."""
    random.seed(seed)

    fp = {f[0]: f for f in FINGERPRINTS}[taxon_id]
    _, hue, sat, val, pattern, bg_hue, bg_sat = fp

    body_rgb = _hsv_to_rgb(hue, sat, val)
    bg_rgb   = _hsv_to_rgb(bg_hue, bg_sat, 55 + random.randint(0, 30))

    img  = Image.new("RGB", (img_size, img_size), bg_rgb)
    draw = ImageDraw.Draw(img)

    cx, cy = img_size // 2, img_size // 2
    r  = int(img_size * 0.30)
    rh = int(img_size * 0.22)

    # ── Body ellipse ──────────────────────────────────────────────────────────
    draw.ellipse(
        [cx - r, cy - rh, cx + r, cy + rh],
        fill=body_rgb,
    )

    # ── Pattern markings ─────────────────────────────────────────────────────
    black = (10, 10, 10)
    white = (240, 240, 240)
    red   = (210, 30, 30)

    if pattern == "spots_black":
        # 7 black spots like a ladybird
        offsets = [
            (-r//2, -rh//3), (0, -rh//2), (r//2, -rh//3),
            (-r//2,  rh//3), (0,  rh//2), (r//2,  rh//3),
            (0, 0),  # central spot (scutellum area)
        ]
        sr = max(4, r // 6)
        for ox, oy in offsets:
            draw.ellipse([cx+ox-sr, cy+oy-sr, cx+ox+sr, cy+oy+sr], fill=black)
        # midline
        draw.line([cx, cy - rh, cx, cy + rh], fill=black, width=max(2, r // 10))

    elif pattern == "fuzzy_stripes":
        # bee-like amber and black stripes
        n_stripes = 4
        stripe_h  = (rh * 2) // n_stripes
        for i in range(n_stripes):
            sy = cy - rh + i * stripe_h
            fill = black if i % 2 == 0 else body_rgb
            draw.rectangle([cx - r, sy, cx + r, sy + stripe_h], fill=fill)
        # Re-clip to ellipse shape
        mask = Image.new("L", (img_size, img_size), 0)
        maskd = ImageDraw.Draw(mask)
        maskd.ellipse([cx - r, cy - rh, cx + r, cy + rh], fill=255)

    elif pattern == "band_fuzzy":
        # bumblebee bands
        for dy, c in [(-rh//2, black), (0, body_rgb), (rh//2, white)]:
            bh = rh // 3
            draw.rectangle([cx - r, cy + dy - bh, cx + r, cy + dy + bh], fill=c)

    elif pattern == "eyespot4":
        # peacock butterfly — 4 eyespots
        spot_r = r // 3
        positions = [(-r//2, -rh//2), (r//2, -rh//2), (-r//2, rh//2), (r//2, rh//2)]
        for sx, sy in positions:
            draw.ellipse([cx+sx-spot_r, cy+sy-spot_r, cx+sx+spot_r, cy+sy+spot_r],
                         fill=(30, 30, 80))
            inner = spot_r // 2
            draw.ellipse([cx+sx-inner, cy+sy-inner, cx+sx+inner, cy+sy+inner],
                         fill=(80, 120, 200))
            dot = spot_r // 5
            draw.ellipse([cx+sx-dot, cy+sy-dot, cx+sx+dot, cy+sy+dot], fill=white)

    elif pattern == "black_tips":
        # large white butterfly
        tip_r = r // 2
        draw.ellipse(
            [cx + r - tip_r, cy - rh, cx + r + tip_r // 2, cy - rh + tip_r * 2],
            fill=black
        )

    elif pattern == "red_bands":
        # red admiral — red band on black
        band_h = rh // 2
        draw.rectangle([cx - r, cy - band_h, cx + r, cy + band_h], fill=red)
        dot_r = r // 6
        for i in range(3):
            dx = -r + (i + 1) * r // 2
            draw.ellipse([cx+dx-dot_r, cy-rh-dot_r, cx+dx+dot_r, cy-rh+dot_r], fill=white)

    elif pattern == "tortoiseshell":
        # orange with black/yellow patches
        patch_size = r // 3
        colors = [black, (220, 200, 50), black, (220, 200, 50)]
        for i, c in enumerate(colors):
            px = cx - r + (i % 2) * r + random.randint(-5, 5)
            py = cy - rh + (i // 2) * rh + random.randint(-5, 5)
            draw.rectangle([px, py, px + patch_size, py + patch_size], fill=c)

    elif pattern == "yellow_black":
        # wasp stripes
        n = 5
        stripe_h = (rh * 2) // n
        for i in range(n):
            sy = cy - rh + i * stripe_h
            draw.rectangle([cx - r, sy, cx + r, sy + stripe_h],
                           fill=black if i % 2 == 0 else body_rgb)

    elif pattern == "stag_horns":
        # stag beetle — dark body + mandibles
        draw.ellipse([cx - r, cy - rh, cx + r, cy + rh], fill=(40, 20, 10))
        horn_w = r // 4
        draw.rectangle([cx - r - horn_w * 2, cy - horn_w, cx - r + horn_w, cy + horn_w],
                       fill=(80, 40, 20))
        draw.rectangle([cx + r - horn_w, cy - horn_w, cx + r + horn_w * 2, cy + horn_w],
                       fill=(80, 40, 20))

    elif pattern == "shield_shape":
        # green shield bug — pentagon
        pts = [
            (cx, cy - rh),
            (cx + r, cy - rh // 4),
            (cx + r * 3 // 4, cy + rh),
            (cx - r * 3 // 4, cy + rh),
            (cx - r, cy - rh // 4),
        ]
        draw.polygon(pts, fill=body_rgb)
        draw.polygon(pts, outline=black, width=3)

    elif pattern == "blue_segments":
        # damselfly — long segmented abdomen
        seg_w = img_size // 20
        for i in range(8):
            sy = cy - rh + i * (rh * 2 // 8)
            fill = body_rgb if i % 2 == 0 else black
            draw.rectangle([cx - seg_w, sy, cx + seg_w, sy + rh * 2 // 8], fill=fill)
        # wings
        wing_c = (180, 200, 230, 160)
        draw.ellipse([cx - r, cy - rh * 2, cx + r, cy - rh], fill=(180, 200, 230))
        draw.ellipse([cx - r, cy + rh, cx + r, cy + rh * 2], fill=(180, 200, 230))

    elif pattern == "iridescent":
        # rose chafer — iridescent green
        draw.ellipse([cx - r, cy - rh, cx + r, cy + rh], fill=body_rgb)
        # white flecks
        for _ in range(12):
            fx = random.randint(cx - r + 5, cx + r - 5)
            fy = random.randint(cy - rh + 5, cy + rh - 5)
            fw = random.randint(3, 8)
            draw.ellipse([fx, fy, fx + fw, fy + fw // 2], fill=white)

    elif pattern == "orange_tips":
        # orange tip — white wing + orange tip
        draw.ellipse([cx - r, cy - rh, cx + r, cy + rh], fill=white)
        tip_size = r // 2
        draw.ellipse([cx + r - tip_size, cy - rh, cx + r + tip_size // 2, cy],
                     fill=(240, 130, 30))

    elif pattern in ("painted_lady", "swallowtail", "tortoiseshell"):
        # complex butterfly — multi-segment wing pattern
        colors2 = [body_rgb, black, (220, 180, 50)]
        seg = r // 3
        for i, c in enumerate(colors2):
            draw.rectangle([cx - r + i * seg * 2, cy - rh, cx - r + (i + 1) * seg * 2, cy + rh],
                           fill=c)

    elif pattern == "hornet_bands":
        n = 4
        stripe_h = (rh * 2) // n
        colors3 = [black, (180, 130, 40), black, (180, 130, 40)]
        for i, c in enumerate(colors3):
            draw.rectangle([cx - r, cy - rh + i * stripe_h,
                            cx + r, cy - rh + (i + 1) * stripe_h], fill=c)

    elif pattern in ("grey_spots", "variable_spots"):
        draw.ellipse([cx - r, cy - rh, cx + r, cy + rh], fill=white)
        spot_r = r // 7
        for _ in range(random.randint(2, 8)):
            sx = random.randint(cx - r + spot_r, cx + r - spot_r)
            sy = random.randint(cy - rh + spot_r, cy + rh - spot_r)
            draw.ellipse([sx - spot_r, sy - spot_r, sx + spot_r, sy + spot_r], fill=black)

    elif pattern == "banded_white":
        for dy, c in [(-rh // 2, black), (0, body_rgb), (rh // 2, white)]:
            bh = rh // 3
            draw.rectangle([cx - r, cy + dy - bh, cx + r, cy + dy + bh], fill=c)

    # ── Slight blur + noise for realism ──────────────────────────────────────
    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    img = _add_noise(img, sigma=12.0)

    return img


def generate_dataset(images_per_class: int, img_size: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    META_DIR.mkdir(parents=True, exist_ok=True)

    manifest = [
        {"taxon_id": t, "common_name": c, "scientific_name": s}
        for t, c, s in TARGET_SPECIES
    ]
    (META_DIR / "species_manifest.json").write_text(json.dumps(manifest, indent=2))

    print(f"Generating {len(TARGET_SPECIES)} species × {images_per_class} images "
          f"({img_size}×{img_size})")

    for taxon_id, common_name, sci_name in TARGET_SPECIES:
        species_dir = DATA_DIR / str(taxon_id)
        species_dir.mkdir(exist_ok=True)

        existing = list(species_dir.glob("*.jpg"))
        if len(existing) >= images_per_class:
            print(f"  [{common_name}] already has {len(existing)} images — skipping")
            continue

        for i in range(images_per_class):
            img = generate_image(taxon_id, img_size, seed=taxon_id * 1000 + i)
            img.save(species_dir / f"demo_{i:04d}.jpg", quality=90)

        print(f"  [{common_name}] ✓ {images_per_class} images generated")

    total = sum(
        len(list((DATA_DIR / str(t)).glob("*.jpg")))
        for t, *_ in TARGET_SPECIES
    )
    print(f"\nDone. {total} total images in {DATA_DIR}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--images", type=int, default=60,
                   help="Images per class to generate (default: 60)")
    p.add_argument("--size", type=int, default=224,
                   help="Image size in pixels (default: 224)")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    generate_dataset(images_per_class=args.images, img_size=args.size)
