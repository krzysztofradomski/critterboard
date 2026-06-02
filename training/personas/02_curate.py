"""
STEP 2: Curate the seed examples.
=================================
Walks through the JSONL produced by 01_seed_examples.py, lets you accept,
edit, or reject each row. Anything you accept is appended to
data/curated/<persona>.jsonl, which is the file 03_train_lora.py reads.

The hand-written examples in examples/<persona>.jsonl are pre-merged so
the curated dataset is never empty.

Usage:
    python 02_curate.py larva
    python 02_curate.py snail --skip-prompts 50      # continue from row 50
    python 02_curate.py maywind --auto-accept        # rubber-stamp all (testing only)

Keybindings during review:
    [a] accept as-is
    [e] edit the output in $EDITOR (or nano)
    [r] reject
    [q] quit and save what you have so far
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT      = Path(__file__).resolve().parent
SEED_DIR  = ROOT / "data" / "seed"
CUR_DIR   = ROOT / "data" / "curated"
HAND_DIR  = ROOT / "examples"
CUR_DIR.mkdir(parents=True, exist_ok=True)

VALID_PERSONAS = {"larva", "snail", "maywind"}


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def save_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def edit_in_editor(text: str) -> str:
    """Open $EDITOR (falls back to nano) on a temp file containing `text`."""
    editor_env = os.environ.get("EDITOR", "nano")
    # Support "code --wait" style values; guard against malformed strings.
    try:
        editor_parts = shlex.split(editor_env) or ["nano"]
    except ValueError:
        editor_parts = ["nano"]
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w+", delete=False) as f:
        f.write(text)
        path = f.name
    try:
        subprocess.run([*editor_parts, path], check=False)
        return Path(path).read_text(encoding="utf-8").strip()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def merge_handwritten(persona: str) -> list[dict]:
    """
    The 10 hand-written examples are the ground truth — they're always
    in the curated set, no review needed.
    """
    hand = load_jsonl(HAND_DIR / f"{persona}.jsonl")
    # Strip any provenance keys
    return [{"instruction": r["instruction"], "input": r.get("input", ""), "output": r["output"]} for r in hand]


def curate(persona: str, skip: int, auto_accept: bool) -> None:
    seed_path = SEED_DIR / f"{persona}.jsonl"
    cur_path  = CUR_DIR  / f"{persona}.jsonl"

    seed = load_jsonl(seed_path)
    if not seed:
        print(f"No seed file at {seed_path}. Run 01_seed_examples.py first.")
        sys.exit(1)

    # Always start from the hand-written + any previously-curated rows
    accepted: list[dict] = merge_handwritten(persona)
    prior = load_jsonl(cur_path)
    prior_keys = {(r["instruction"], r["output"]) for r in accepted}
    for r in prior:
        key = (r["instruction"], r["output"])
        if key not in prior_keys:
            accepted.append(r)
            prior_keys.add(key)

    print(f"\nStarting curation for [{persona}]")
    print(f"  Hand-written merged: {len(merge_handwritten(persona))}")
    print(f"  Already curated:     {len(prior)}")
    print(f"  Seeds to review:     {len(seed) - skip}\n")

    try:
        for i, row in enumerate(seed[skip:], start=skip):
            print("─" * 70)
            print(f"[{i + 1}/{len(seed)}]  Q: {row['instruction']}")
            print(f"            A: {row['output']}")

            if auto_accept:
                accepted.append({"instruction": row["instruction"], "input": "", "output": row["output"]})
                continue

            while True:
                choice = input("  (a)ccept / (e)dit / (r)eject / (q)uit ? ").strip().lower() or "a"
                if choice in {"a", "e", "r", "q"}:
                    break

            if choice == "q":
                break
            if choice == "r":
                continue
            if choice == "e":
                edited = edit_in_editor(row["output"])
                accepted.append({"instruction": row["instruction"], "input": "", "output": edited})
            else:
                accepted.append({"instruction": row["instruction"], "input": "", "output": row["output"]})
    except KeyboardInterrupt:
        print("\nInterrupted — saving what we have.")

    save_jsonl(cur_path, accepted)
    print(f"\nWrote {len(accepted)} rows to {cur_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("persona", choices=sorted(VALID_PERSONAS))
    parser.add_argument("--skip-prompts", type=int, default=0,
                        help="Skip the first N seed rows (continue from where you stopped)")
    parser.add_argument("--auto-accept", action="store_true",
                        help="Accept every seed without prompting (testing only)")
    args = parser.parse_args()
    curate(args.persona, args.skip_prompts, args.auto_accept)


if __name__ == "__main__":
    main()
