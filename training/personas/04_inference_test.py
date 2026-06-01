"""
STEP 4: Eyeball the trained adapters.
=====================================
Loads the base model once, then for each persona prints two answers
side-by-side:

  1. BASELINE — base + system prompt only (what the app does today)
  2. LORA     — base + adapter (what the app will do after this lands)

This is the smoke test. If LORA answers don't sound more in-character
than BASELINE, you don't have enough curated examples yet. Train with
more before exporting.

Usage:
    python 04_inference_test.py
    python 04_inference_test.py --prompt "is this hoverfly going to sting me?"
    python 04_inference_test.py --persona snail
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
except ImportError as e:
    print(f"Missing dependency: {e}; run pip install -r requirements.txt")
    sys.exit(1)

ROOT       = Path(__file__).resolve().parent
APP_ROOT   = ROOT.parent.parent
PERSONA_TS = APP_ROOT / "src" / "personas" / "index.ts"
ADAPTER_DIR = ROOT / "adapters"

BASE_MODEL = "google/gemma-3-1b-it"
DEFAULT_PROMPTS = [
    "what's the difference between a moth and a butterfly?",
    "is this hoverfly going to sting me?",
    "are wasps useful for anything?",
]


def load_persona_prompts() -> dict[str, str]:
    text = PERSONA_TS.read_text(encoding="utf-8")
    blocks = re.findall(
        r"(larva|snail|maywind)\s*:\s*\{[^}]*systemPrompt:\s*'([^']+)'",
        text, re.DOTALL,
    )
    return dict(blocks)


def generate(model, tokenizer, system: str, user: str, max_new_tokens: int = 120) -> str:
    messages = [
        {"role": "system",  "content": system},
        {"role": "user",    "content": user},
    ]
    input_ids = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, return_tensors="pt"
    ).to(model.device)
    with torch.no_grad():
        out = model.generate(
            input_ids,
            max_new_tokens=max_new_tokens,
            temperature=0.8,
            top_p=0.95,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    new_tokens = out[0, input_ids.shape[1]:]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--persona", default="all", choices=["all", "larva", "snail", "maywind"])
    parser.add_argument("--prompt", default=None, help="Override the default question set")
    args = parser.parse_args()

    prompts = load_persona_prompts()
    personas = ["larva", "snail", "maywind"] if args.persona == "all" else [args.persona]
    questions = [args.prompt] if args.prompt else DEFAULT_PROMPTS

    print(f"Loading {BASE_MODEL}...")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token
    dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    base = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
    )

    for persona in personas:
        adapter_path = ADAPTER_DIR / persona
        if not adapter_path.exists():
            print(f"\n[{persona}] No adapter at {adapter_path} — run 03_train_lora.py first.")
            continue

        print(f"\n{'═' * 70}\n  {persona.upper()}\n{'═' * 70}")
        # Build the LoRA-augmented variant. We re-attach each time so the
        # baseline stays clean.
        peft_model = PeftModel.from_pretrained(base, str(adapter_path))

        for q in questions:
            print(f"\n→ {q}\n")
            base_ans = generate(base,        tokenizer, prompts[persona], q)
            lora_ans = generate(peft_model,  tokenizer, prompts[persona], q)
            print(f"  BASELINE: {base_ans}\n")
            print(f"  LORA    : {lora_ans}\n")

        peft_model.unload()


if __name__ == "__main__":
    main()
