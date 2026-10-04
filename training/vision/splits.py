"""Photographer-grouped train/val/test split shared by the selection scripts."""

import hashlib


def split_of_observer(observer, seed, test_frac, val_frac):
    """Deterministic split per photographer, shared by every species.

    A photographer lands in exactly one split for the whole dataset, so the
    test score measures generalisation to people the model never saw. (The
    first commercial build split per species instead, which let the same
    photographer sit in train for one species and test for another.)
    """
    h = hashlib.sha256(f"{seed}:{observer}".encode()).digest()
    u = int.from_bytes(h[:8], "big") / 2**64
    if u < test_frac:
        return "test"
    if u < test_frac + val_frac:
        return "val"
    return "train"
