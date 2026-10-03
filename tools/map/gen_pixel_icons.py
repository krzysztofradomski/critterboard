"""Generate the map's pixel-art PNGs into assets/map/ (12x12 art, drawn 2x).

Run from the repo root: python3 tools/map/gen_pixel_icons.py
"""
import struct
import zlib

PAL = {'x': (0x3a, 0x26, 0x18), 'g': (0x4f, 0xa8, 0x5a), 'G': (0x8f, 0xd6, 0x8a),
       'b': (0x8a, 0x5a, 0x2b), 'y': (0xf5, 0xc8, 0x42), 'p': (0xf2, 0x7a, 0xa8),
       's': (0xa8, 0xa8, 0xb8), 'w': (0xff, 0xff, 0xff), 'W': (0xd6, 0xea, 0xff),
       'n': (0xcf, 0xbe, 0x98),
       # Catch pin: PB.ink / PB.purple / PB.cream.
       'k': (0x1a, 0x12, 0x08), 'P': (0x8a, 0x4d, 0xd4), 'c': (0xff, 0xf4, 0xdc),
       # Other players' sightings: PB.blue.
       'B': (0x2a, 0x6d, 0xf0)}

ICONS = {
    "poi-tree": [
        "....xxxx....",
        "..xxGggxxx..",
        ".xGGgggggxx.",
        ".xGgggggggx.",
        "xxgggggggggx",
        "xgggggggggxx",
        "xggggggggggx",
        ".xgggggggxx.",
        "..xxxgxxxx..",
        ".....xbx....",
        ".....xbx....",
        "....xxbxx...",
    ],
    "poi-flower": [
        "............",
        "....xx.xx...",
        "...xppxppx..",
        "...xppxppx..",
        "..xxppyppxx.",
        "..xppyyyppx.",
        "..xxppyppxx.",
        "...xppxppx..",
        "....xxgxx...",
        ".....xg.....",
        "...xxxgxx...",
        "....xgxg....",
    ],
    "poi-peak": [
        "............",
        ".....xx.....",
        "....xwwx....",
        "...xwwwwx...",
        "..xxwwwwxx..",
        "..xsxwwxsx..",
        ".xssssxsssx.",
        ".xssssssssx.",
        "xssssssssssx",
        "xssssssssssx",
        "xxxxxxxxxxxx",
        "............",
    ],
    # "Beyond the map pack": sparse dots on the muted no-data background.
    "nodata": [
        "n...........", "............", "............", "......n.....",
        "............", "............", "............", "............",
        "n...........", "............", "............", "......n.....",
    ],
    # Sparse light wave marks on transparent: sits over the solid sea colour.
    "water-wave": [
        "............", "............", "..WW........", "WW..WW......",
        "............", "............", "....WW......", "...W..WW....",
        "............", "............", "............", "............",
    ],
}


# The pixel bug sprite (16x16 grid), formerly an SVG on each map marker.
BUG = [(7, 4), (8, 4), (7, 5), (8, 5), (7, 6), (8, 6), (7, 7), (8, 7), (7, 8), (8, 8), (7, 9), (8, 9),
       (7, 10), (8, 10), (7, 3), (8, 3), (6, 2), (9, 2), (5, 1), (10, 1), (5, 5), (10, 5), (4, 6),
       (11, 6), (5, 8), (10, 8), (4, 9), (11, 9), (5, 11), (10, 11)]
BUG_ACCENTS = {(7, 5), (8, 5), (7, 8), (8, 8)}


def catch_pin(fill="P"):
    """A catch on the map: coloured disc, ink ring, hard ink shadow, the pixel bug (18x18)."""
    n, c, r = 18, 7.5, 7.3
    inside = lambda x, y, ox=0, oy=0: (x - c - ox) ** 2 + (y - c - oy) ** 2 <= r * r
    art = [["." for _ in range(n)] for _ in range(n)]
    for y in range(n):
        for x in range(n):
            if inside(x, y):
                ring = not all(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                art[y][x] = "k" if ring else fill
            elif inside(x, y, 1.5, 1.5):
                art[y][x] = "k"  # shadow, offset down-right like the stickers
    for (x, y) in BUG:
        art[y + 2][x] = "c" if (x, y) in BUG_ACCENTS else "k"
    return ["".join(row) for row in art]


def png(art, scale=2):
    size = len(art[0]) * scale
    rows = b""
    for y in range(size):
        rows += b"\0"
        for x in range(size):
            c = art[y // scale][x // scale]
            rows += bytes(PAL[c] + (255,)) if c in PAL else b"\0\0\0\0"

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


for name, art in ICONS.items():
    assert all(len(r) == 12 for r in art) and len(art) == 12, name
    open(f"assets/map/{name}.png", "wb").write(png(art))

open("assets/map/pin-catch.png", "wb").write(png(catch_pin()))  # your catches
open("assets/map/pin-sighting.png", "wb").write(png(catch_pin("B")))  # other players' sightings
