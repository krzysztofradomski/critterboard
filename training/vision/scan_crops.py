"""Python copy of src/ai/scanCrops.ts (geometry + score combining), for host-side evaluation.

Keep in sync with the TS file; test_field.py pins this copy to values printed by the TS code.
JS Math.round rounds .5 up, hence jsround, never Python's round().
"""
import math

import numpy as np

RETICLE_SCALES = (1, 1.6)
TAP_FRACS = (0.12, 0.25, 0.5)
TILE = 0.4
TILE_STEP = 0.3
CENTRE_FRAC = 0.6
CROP_PX = 320
APP_VIEW = (375, 812)                    # iPhone 13 mini, points
APP_RETICLE = (187.5, 0.46 * 812, 220)   # Scan.tsx: RETICLE, RETICLE_TOP


def jsround(v):
    return math.floor(v + 0.5)


def reticle_in_photo(photo, view, reticle, fit="cover"):
    pick = max if fit == "cover" else min
    scale = pick(view[0] / photo[0], view[1] / photo[1])
    off_x = (view[0] - photo[0] * scale) / 2
    off_y = (view[1] - photo[1] * scale) / 2
    cx, cy, side = reticle
    return ((cx - off_x) / scale, (cy - off_y) / scale, side / scale)


def square_around(img, cx, cy, side):
    s = jsround(min(side, img[0], img[1]))

    def clamp(v, hi):
        return jsround(min(max(v, 0), hi))

    return (clamp(cx - s / 2, img[0] - s), clamp(cy - s / 2, img[1] - s), s, s)


def crop_rects(img, area):
    cx, cy, side = area
    sides = [k * side for k in RETICLE_SCALES] + [min(img)]
    return [square_around(img, cx, cy, s) for s in sides]


def tap_rects(img, x, y):
    return [square_around(img, x, y, f * min(img)) for f in TAP_FRACS]


def tile_rects(img, area):
    cx, cy, a = area
    side = TILE * a
    n = jsround((1 - TILE) / TILE_STEP) + 1
    x0, y0 = cx - a / 2 + side / 2, cy - a / 2 + side / 2
    return [square_around(img, x0 + i * TILE_STEP * a, y0 + j * TILE_STEP * a, side)
            for i in range(n) for j in range(n)]


def combine_scores(groups):
    best = [max(g, key=lambda p: p.max()) for g in groups if len(g)]
    return np.mean(best, axis=0)
