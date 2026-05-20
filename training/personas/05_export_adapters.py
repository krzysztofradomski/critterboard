"""
STEP 5: Export LoRA adapters to GGUF format.
============================================
llama.rn (the React Native runtime) consumes GGUF for both base models
and LoRA adapters. We use llama.cpp's `convert_lora_to_gguf.py` script.

Output:
  exported/larva.gguf
  exported/snail.gguf
  exported/maywind.gguf

Copy these into ../../assets/models/ and flip USE_LLAMA_RN=true in
src/ai/index.ts.

Usage:
    # one-time: clone llama.cpp somewhere convenient
    git clone https://github.com/ggerganov/llama.cpp ~/code/llama.cpp

    # then:
    python 05_export_adapters.py --llama-cpp ~/code/llama.cpp
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT          = Path(__file__).resolve().parent
ADAPTER_DIR   = ROOT / "adapters"
EXPORT_DIR    = ROOT / "exported"
EXPORT_DIR.mkdir(exist_ok=True)

PERSONAS = ("larva", "snail", "maywind")


def convert_one(persona: str, llama_cpp: Path) -> Path | None:
    adapter_path = ADAPTER_DIR / persona
    if not adapter_path.exists():
        print(f"  [{persona}] no adapter found at {adapter_path} — skipping")
        return None

    convert_script = llama_cpp / "convert_lora_to_gguf.py"
    if not convert_script.exists():
        print(f"Missing {convert_script}. Clone llama.cpp first.")
        sys.exit(1)

    out_file = EXPORT_DIR / f"{persona}.gguf"
    print(f"  [{persona}] converting...")
    subprocess.run(
        [
            sys.executable, str(convert_script),
            str(adapter_path),
            "--outfile", str(out_file),
            "--outtype", "f16",
        ],
        check=True,
    )
    size_mb = out_file.stat().st_size / 1e6
    print(f"  [{persona}] ✓ {out_file.name}  ({size_mb:.1f} MB)")
    return out_file


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--llama-cpp", type=Path, required=True,
                        help="Path to your llama.cpp clone")
    args = parser.parse_args()

    if not args.llama_cpp.exists():
        print(f"llama.cpp not found at {args.llama_cpp}")
        print("  git clone https://github.com/ggerganov/llama.cpp")
        sys.exit(1)

    produced = []
    for persona in PERSONAS:
        result = convert_one(persona, args.llama_cpp)
        if result:
            produced.append(result)

    if not produced:
        print("\nNothing exported. Train adapters first.")
        sys.exit(1)

    print(f"\n{'─' * 50}")
    print(f"Done. {len(produced)} GGUF adapter(s) in {EXPORT_DIR}\n")
    print("Next:")
    print(f"  cp {EXPORT_DIR}/*.gguf ../../assets/models/")
    print( "  edit src/ai/index.ts → USE_LLAMA_RN = true")
    print( "  add llama.rn to package.json")


if __name__ == "__main__":
    main()
