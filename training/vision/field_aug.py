"""Make training photos look like the app's crops of phone photos.

A tightly framed iNaturalist photo is pasted, smaller, onto a plant background (feathered edge),
then degraded the way phone crops are: upscaled from fewer pixels, slightly soft, JPEG-compressed,
a little noisy. Why: docs/ml-roadmap.md, "Scan preprocessing".
"""
import hashlib
import io
import random
from pathlib import Path

from PIL import Image, ImageFilter


def bg_split(photo_id: str) -> str:
    """~20% of backgrounds are kept for the fake-shot test, by a stable hash of the id."""
    return "test" if hashlib.md5(photo_id.encode()).digest()[0] < 52 else "train"


def paste(fg, bg, side: int, xy):
    k = side / max(fg.size)
    fg = fg.resize((max(1, round(fg.width * k)), max(1, round(fg.height * k))), Image.BILINEAR)
    # A wide feather: the pasted photo brings its own background, and a hard-edged patch
    # would teach the model to look for rectangles.
    edge = max(1, min(fg.size) // 6)
    mask = Image.new("L", fg.size, 0)
    mask.paste(255, (edge, edge, fg.width - edge, fg.height - edge))
    mask = mask.filter(ImageFilter.GaussianBlur(edge / 2))
    out = bg.copy()
    out.paste(fg, xy, mask)
    return out


def degrade(img, rng: random.Random):
    w, h = img.size
    f = rng.uniform(1.0, 3.0)  # fewer real pixels, upscaled back
    if f > 1.05:
        img = img.resize((max(8, int(w / f)), max(8, int(h / f))), Image.BILINEAR).resize((w, h), Image.BILINEAR)
    if rng.random() < 0.5:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.2)))
    if rng.random() < 0.3:
        img = Image.blend(img, Image.effect_noise((w, h), rng.uniform(4, 12)).convert("RGB"), 0.06)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=rng.randint(55, 92))
    return Image.open(io.BytesIO(buf.getvalue())).convert("RGB")


class FieldShot:
    """Training transform: the photo pasted at 30-90% of the crop onto a random background square."""

    def __init__(self, backgrounds, size: int):
        self.backgrounds = [Path(p) for p in backgrounds]
        self.size = size

    def __call__(self, img):
        rng = random.Random(random.getrandbits(64))  # DataLoader seeds `random` per worker
        bg = Image.open(rng.choice(self.backgrounds)).convert("RGB")
        s = rng.randint(min(bg.size) // 2, min(bg.size))
        x, y = rng.randint(0, bg.width - s), rng.randint(0, bg.height - s)
        bg = bg.crop((x, y, x + s, y + s)).resize((self.size, self.size), Image.BILINEAR)
        side = int(self.size * rng.uniform(0.3, 0.9))
        k = side / max(img.size)
        fw, fh = int(img.width * k), int(img.height * k)
        out = paste(img, bg, side, (rng.randint(0, self.size - fw), rng.randint(0, self.size - fh)))
        return degrade(out, rng)
