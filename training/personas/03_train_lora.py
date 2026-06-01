"""
STEP 3: Train one LoRA adapter per persona.
===========================================
Uses PEFT + TRL's SFTTrainer on top of google/gemma-3-1b-it.
Each persona's curated dataset becomes a small adapter (~15 MB) that we
hot-swap at runtime via llama.rn.

Hardware notes:
  - CUDA T4 (Kaggle): ~10-15 min per persona at 300 rows × 3 epochs
  - CUDA T4 ×2: same wall time, ~doubled throughput
  - M-series MPS: ~30-45 min per persona, set BATCH_SIZE=2

Output:
  adapters/<persona>/  →  adapter_config.json + adapter_model.safetensors

Usage:
    python 03_train_lora.py                          # all three personas
    python 03_train_lora.py --personas larva,snail   # subset
    python 03_train_lora.py --dry-run                # verify config + dataset, skip training
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
    from trl import SFTTrainer
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

ROOT       = Path(__file__).resolve().parent
APP_ROOT   = ROOT.parent.parent
PERSONA_TS = APP_ROOT / "src" / "personas" / "index.ts"
CUR_DIR    = ROOT / "data" / "curated"
OUT_DIR    = ROOT / "adapters"
OUT_DIR.mkdir(exist_ok=True)

CFG = {
    "base_model":     "google/gemma-3-1b-it",
    "max_seq_len":    512,
    "batch_size":     8,         # 8 on T4, drop to 2 on MPS
    "grad_accum":     2,
    "epochs":         3,
    "lr":             2e-4,
    "lora_r":         16,
    "lora_alpha":     32,
    "lora_dropout":   0.05,
    "warmup_steps":   10,
    "weight_decay":   0.01,
    # Gemma 3 shares the same attention + MLP projection names as Llama.
    "lora_targets":   ["q_proj", "k_proj", "v_proj", "o_proj",
                       "gate_proj", "up_proj", "down_proj"],
}

VALID_PERSONAS = ("larva", "snail", "maywind")


# ── Persona prompts: parse the React Native source. ────────────────────────
def load_persona_prompts() -> dict[str, str]:
    text = PERSONA_TS.read_text(encoding="utf-8")
    blocks = re.findall(
        r"(larva|snail|maywind)\s*:\s*\{[^}]*systemPrompt:\s*'([^']+)'",
        text, re.DOTALL,
    )
    return dict(blocks)


# ── Dataset shaping ────────────────────────────────────────────────────────
def to_chat(row: dict, system_prompt: str) -> dict:
    """
    Format one curated row using the standard HuggingFace messages dict.
    SFTTrainer calls tokenizer.apply_chat_template() which automatically
    applies Gemma 3's <start_of_turn> format. The system prompt is folded
    into the first user turn by the tokenizer (Gemma 3 style).
    """
    return {
        "messages": [
            {"role": "system",    "content": system_prompt},
            {"role": "user",      "content": row["instruction"]},
            {"role": "assistant", "content": row["output"]},
        ]
    }


def build_dataset(persona: str, system_prompt: str, tokenizer) -> Dataset:
    path = CUR_DIR / f"{persona}.jsonl"
    if not path.exists():
        raise FileNotFoundError(f"Run 02_curate.py {persona} first; missing {path}")
    raw = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(raw) < 30:
        print(f"⚠ Only {len(raw)} examples for [{persona}] — model will wobble. Aim for 300+.")

    rows = [to_chat(r, system_prompt) for r in raw]
    ds = Dataset.from_list(rows)
    # SFTTrainer applies the chat template via tokenizer; nothing else to do here.
    return ds


# ── Training loop ──────────────────────────────────────────────────────────
def train_one(persona: str, system_prompt: str, dry_run: bool) -> None:
    print(f"\n══════════════════════════════════════════")
    print(f"  Training LoRA for [{persona}]")
    print(f"══════════════════════════════════════════")

    tokenizer = AutoTokenizer.from_pretrained(CFG["base_model"])
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token

    ds = build_dataset(persona, system_prompt, tokenizer)
    print(f"  Dataset: {len(ds)} examples")
    if dry_run:
        print(f"  Dry run — skipping training.")
        return

    device_map = "auto" if torch.cuda.is_available() else None
    dtype      = torch.bfloat16 if torch.cuda.is_available() else torch.float32

    base = AutoModelForCausalLM.from_pretrained(
        CFG["base_model"], torch_dtype=dtype, device_map=device_map,
    )

    lora = LoraConfig(
        r=CFG["lora_r"],
        lora_alpha=CFG["lora_alpha"],
        lora_dropout=CFG["lora_dropout"],
        target_modules=CFG["lora_targets"],
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(base, lora)
    model.print_trainable_parameters()

    out_dir = OUT_DIR / persona
    args = TrainingArguments(
        output_dir=str(out_dir),
        per_device_train_batch_size=CFG["batch_size"],
        gradient_accumulation_steps=CFG["grad_accum"],
        num_train_epochs=CFG["epochs"],
        learning_rate=CFG["lr"],
        warmup_steps=CFG["warmup_steps"],
        weight_decay=CFG["weight_decay"],
        logging_steps=10,
        save_strategy="epoch",
        save_total_limit=1,
        bf16=torch.cuda.is_available(),
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        args=args,
        train_dataset=ds,
        max_seq_length=CFG["max_seq_len"],
    )
    trainer.train()
    trainer.save_model(str(out_dir))
    print(f"  ✓ Saved adapter → {out_dir}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--personas", default=",".join(VALID_PERSONAS))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    prompts = load_persona_prompts()
    targets = [p.strip() for p in args.personas.split(",") if p.strip() in VALID_PERSONAS]

    for persona in targets:
        train_one(persona, prompts[persona], args.dry_run)

    print(f"\nAll done. Next: python 04_inference_test.py --persona {targets[0]}")


if __name__ == "__main__":
    main()
