"""
STEP 1: Bootstrap persona examples via the Anthropic API.
=========================================================
Reads each persona's system prompt straight out of the React Native source
(src/personas/index.ts is the single source of truth — do NOT duplicate
the strings here) and asks Claude to play that persona against ~80 stock
entomology questions.

Output: data/seed/<persona>.jsonl, one example per line.
        Hand the file to 02_curate.py before it touches training.

Cost: ~$1-3 of Claude API spend per run with claude-3-5-haiku.
Time: ~5-10 minutes.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python 01_seed_examples.py
    python 01_seed_examples.py --personas larva,snail   # subset
    python 01_seed_examples.py --model claude-opus-4-5  # better but pricier
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("pip install anthropic"); sys.exit(1)

ROOT       = Path(__file__).resolve().parent
APP_ROOT   = ROOT.parent.parent
PERSONA_TS = APP_ROOT / "src" / "personas" / "index.ts"
SEED_DIR   = ROOT / "data" / "seed"
SEED_DIR.mkdir(parents=True, exist_ok=True)

# ── The questions ──────────────────────────────────────────────────────────
# Designed to span: ID, behaviour, safety, ecology, lifecycle, taxonomy.
# Mix of beginner and slightly-niche so the model has range to flex personality.
QUESTIONS = [
    # ── ID basics
    "what's the difference between a moth and a butterfly?",
    "is this honeybee or a wasp?",
    "how do I tell a hoverfly from a wasp?",
    "is the orange one with black spots a ladybird or a harlequin?",
    "what's that giant beetle with horns I saw in the garden?",
    "how do you identify a bumblebee species?",
    "what does a praying mantis look like?",
    "are damselflies the same as dragonflies?",
    # ── Behaviour
    "why do moths fly at lights?",
    "how do ants find food?",
    "do butterflies sleep?",
    "why do bees buzz?",
    "what's the waggle dance?",
    "do insects feel pain?",
    "how far can a monarch butterfly migrate?",
    "why do crickets chirp at night?",
    # ── Safety
    "is this spider venomous?",
    "what should I do if a hornet lands on me?",
    "are paper wasps aggressive?",
    "is the orange and black caterpillar I found safe to touch?",
    "are ticks insects?",
    "what bug can kill a dog if eaten?",
    "are stink bugs dangerous?",
    "is the brown recluse really that bad?",
    # ── Ecology
    "are wasps useful for anything?",
    "why are bees declining?",
    "what role do dung beetles play?",
    "are mosquitoes good for anything?",
    "why are dragonflies considered indicator species?",
    "what insects are pollinators besides bees?",
    "what happens if all the insects disappear?",
    "what's the most important insect for agriculture?",
    # ── Lifecycle
    "how long does a butterfly live?",
    "what do dragonfly larvae eat?",
    "how do caterpillars turn into butterflies?",
    "what's a chrysalis vs a cocoon?",
    "how long does a cicada stay underground?",
    "why do mayflies only live one day?",
    "what's an instar?",
    "do all insects metamorphose?",
    # ── Taxonomy / 'big' questions
    "what's the biggest insect in the world?",
    "what's the smallest?",
    "how many insect species are there?",
    "what's the oldest insect species still alive today?",
    "is a spider an insect?",
    "what makes something an insect vs a bug?",
    "are centipedes insects?",
    # ── Practical
    "I found a ladybug in my house. should I let it go outside?",
    "how do I get rid of aphids without pesticides?",
    "what's the best plant to attract butterflies?",
    "how do I help bees in winter?",
    "should I save earwigs from drowning in the pool?",
    "what's a butterfly puddling spot?",
    "how do I build a bug hotel?",
    "what attracts fireflies to a yard?",
    # ── Misc / fun
    "why do fireflies glow?",
    "do bees recognise faces?",
    "what's the rarest insect I might see in my garden?",
    "is the praying mantis I caught a male or female?",
    "is it true cockroaches survive nuclear blasts?",
    "what insect has the most painful sting?",
    "can you keep a butterfly as a pet?",
    "do insects dream?",
    "what bug is the strongest relative to its body weight?",
    "are honeybees native to North America?",
    "how do insects breathe?",
    "do bees sleep?",
    "what's the loudest insect?",
    "why are some butterflies blue?",
    "what insect lives the longest?",
    "are queen ants the actual queens?",
    "how do scorpion flies mate?",
    "what is a robber fly?",
    "why do leafhoppers spit?",
    "are silverfish really that bad?",
    "what do woodlice eat?",
    "why are some moths so giant?",
    "how do water striders walk on water?",
]
assert len(QUESTIONS) >= 75, "Add more questions — we want ~80 per persona"


# ── Parse the TS source for the persona system prompts ─────────────────────
def load_persona_prompts() -> dict[str, str]:
    """
    Cheap regex parse of the React Native persona source. We don't want
    to duplicate the strings here — the app's prompts ARE the spec.
    """
    text = PERSONA_TS.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    # Match keys like:  larva: { id: 'larva', ...  systemPrompt: '...'   ... },
    persona_blocks = re.findall(
        r"(larva|snail|maywind)\s*:\s*\{[^}]*systemPrompt:\s*'([^']+)'",
        text, re.DOTALL,
    )
    for name, prompt in persona_blocks:
        out[name] = prompt
    missing = {"larva", "snail", "maywind"} - out.keys()
    if missing:
        raise RuntimeError(f"Could not extract systemPrompt for: {missing}")
    return out


# ── Drive Claude ───────────────────────────────────────────────────────────
def ask_claude(client, model: str, system: str, question: str) -> str | None:
    """
    One question → one persona answer. Retry once on transient API errors.
    """
    for attempt in range(2):
        try:
            msg = client.messages.create(
                model=model,
                max_tokens=180,
                temperature=0.85,
                system=system,
                messages=[{"role": "user", "content": question}],
            )
            text = msg.content[0].text.strip() if msg.content else ""
            return text or None
        except anthropic.APIStatusError as e:
            print(f"    API error ({e.status_code}); retrying once...")
            time.sleep(2)
        except Exception as e:
            print(f"    Unexpected: {e}")
            return None
    return None


def generate_for_persona(client, model: str, persona: str, system_prompt: str) -> int:
    out_path = SEED_DIR / f"{persona}.jsonl"
    written = 0
    with open(out_path, "w", encoding="utf-8") as f:
        for q in QUESTIONS:
            reply = ask_claude(client, model, system_prompt, q)
            if not reply:
                continue
            row = {"instruction": q, "input": "", "output": reply, "_persona": persona}
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1
            print(f"  [{persona}] {q[:50]:<50} → {reply[:60]}...")
            time.sleep(0.4)   # be polite to the API
    return written


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--personas", default="larva,snail,maywind",
                        help="Comma-separated subset")
    parser.add_argument("--model", default="claude-haiku-4-5",
                        help="Anthropic model (haiku is cheapest, opus is best)")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Set ANTHROPIC_API_KEY first."); sys.exit(1)

    prompts = load_persona_prompts()
    targets = [p.strip() for p in args.personas.split(",") if p.strip() in prompts]
    print(f"Personas: {targets}")
    print(f"Model:    {args.model}")
    print(f"Questions per persona: {len(QUESTIONS)}\n")

    client = anthropic.Anthropic()
    grand_total = 0
    for persona in targets:
        print(f"── {persona} ─────────────────────────────────────────")
        n = generate_for_persona(client, args.model, persona, prompts[persona])
        grand_total += n
        print(f"  → {n} examples written to {SEED_DIR / (persona + '.jsonl')}\n")

    print(f"Done. {grand_total} examples total.")
    print(f"Next: python 02_curate.py <persona>")


if __name__ == "__main__":
    main()
