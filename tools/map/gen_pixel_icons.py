"""Generate the map's pixel-art PNGs into assets/map/ (12x12 art, drawn 2x).

Run from the repo root: python3 tools/map/gen_pixel_icons.py
"""
import struct
import zlib

PAL = {'x': (0x3a, 0x26, 0x18), 'g': (0x4f, 0xa8, 0x5a), 'G': (0x8f, 0xd6, 0x8a),
       'b': (0x8a, 0x5a, 0x2b), 'y': (0xf5, 0xc8, 0x42), 'p': (0xf2, 0x7a, 0xa8),
       's': (0xa8, 0xa8, 0xb8), 'w': (0xff, 0xff, 0xff), 'W': (0xd6, 0xea, 0xff),
       'n': (0xcf, 0xbe, 0x98)}

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
