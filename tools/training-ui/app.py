"""
Critterboard Training Dashboard
=================================
Streamlit GUI for training both the vision classifier and persona LoRA adapters.

Run from anywhere in the repo:
    streamlit run tools/training-ui/app.py

Or from this directory:
    streamlit run app.py
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pandas as pd
import streamlit as st

# ── Path constants ─────────────────────────────────────────────────────────────

TOOL_DIR     = Path(__file__).resolve().parent
ROOT_DIR     = TOOL_DIR.parent.parent            # critterboard root
TRAINING_DIR = ROOT_DIR / "training"
LOCAL_DIR    = TRAINING_DIR / "local"
PERSONAS_DIR = TRAINING_DIR / "personas"
MODELS_DIR   = ROOT_DIR / "assets" / "models"

LOCAL_DATA_DIR   = LOCAL_DIR / "data" / "images"
LOCAL_META_DIR   = LOCAL_DIR / "data" / "meta"
LOCAL_CKPT_DIR   = LOCAL_DIR / "checkpoints"
LOCAL_EXPO_DIR   = LOCAL_DIR / "exported"

PERSONAS_SEED_DIR    = PERSONAS_DIR / "data" / "seed"
PERSONAS_CURATED_DIR = PERSONAS_DIR / "data" / "curated"
PERSONAS_CKPT_DIR    = PERSONAS_DIR / "checkpoints"
PERSONAS_EXPO_DIR    = PERSONAS_DIR / "exported"

PERSONA_NAMES = ["larva", "snail", "maywind"]

# ── Page config ────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Critterboard Training",
    page_icon="🦗",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={"About": "Critterboard local training dashboard — runs fully offline."},
)

st.markdown("""
<style>
    /* tighter metric cards */
    [data-testid="metric-container"] { padding: 4px 0; }
    /* muted caption color */
    .step-caption { color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; }
    /* code output scrollable */
    .stCodeBlock { max-height: 400px; overflow-y: auto; }
</style>
""", unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════════════════
# SHARED UTILITIES
# ════════════════════════════════════════════════════════════════════════════════

def dir_has_files(d: Path) -> bool:
    try:
        return d.exists() and any(True for _ in d.iterdir())
    except Exception:
        return False


def jsonl_count(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        with open(path, encoding="utf-8") as f:
            return sum(1 for line in f if line.strip())
    except Exception:
        return 0


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


def save_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def file_size_str(path: Path) -> str:
    """Human-readable file/dir size."""
    try:
        if path.is_file():
            sz = path.stat().st_size
        elif path.is_dir():
            sz = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
        else:
            return "—"
        if sz >= 1e9:
            return f"{sz/1e9:.2f} GB"
        if sz >= 1e6:
            return f"{sz/1e6:.1f} MB"
        return f"{sz/1e3:.0f} KB"
    except Exception:
        return "—"


def tick(ok: bool) -> str:
    return "✅" if ok else "❌"


def run_script(
    cmd: list[str],
    cwd: Path = None,
    env: dict = None,
    spinner_text: str = "Running…",
) -> tuple[int, str]:
    """
    Spawn a subprocess and stream its stdout+stderr into a Streamlit code block.
    Returns (returncode, full_output_string).
    """
    merged_env = {**os.environ, **(env or {})}
    lines: list[str] = []
    output_box = st.empty()

    with st.spinner(spinner_text):
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=str(cwd) if cwd else None,
                env=merged_env,
            )
            for raw in proc.stdout:
                lines.append(raw)
                output_box.code("".join(lines[-60:]), language="")
            proc.wait()
        except FileNotFoundError as exc:
            st.error(f"Command not found: {exc}")
            return 1, ""

    full_output = "".join(lines)
    if proc.returncode == 0:
        st.success("✓ Completed successfully")
    else:
        st.error(f"✗ Process exited with code {proc.returncode}")
    return proc.returncode, full_output


# ════════════════════════════════════════════════════════════════════════════════
# SIDEBAR — live status
# ════════════════════════════════════════════════════════════════════════════════

data_exists  = dir_has_files(LOCAL_DATA_DIR)
ckpt_exists  = (LOCAL_CKPT_DIR / "best_model.pth").exists()
onnx_exists  = (LOCAL_EXPO_DIR / "insect_classifier.onnx").exists()
mlpkg_exists = (LOCAL_EXPO_DIR / "insect_classifier.mlpackage").exists()

with st.sidebar:
    st.markdown("## 🦗 Critterboard\n### Training Dashboard")
    st.caption(f"`{ROOT_DIR.name}/`")
    st.divider()

    st.markdown("**Vision Classifier**")
    for ok, label in [
        (data_exists,  "Dataset downloaded"),
        (ckpt_exists,  "Model checkpoint"),
        (onnx_exists,  "ONNX export"),
        (mlpkg_exists, "CoreML export"),
    ]:
        st.markdown(f"{'🟢' if ok else '⚪'} {label}")

    st.divider()
    st.markdown("**Persona Adapters**")
    for persona in PERSONA_NAMES:
        seed_n    = jsonl_count(PERSONAS_SEED_DIR / f"{persona}.jsonl")
        curated_n = jsonl_count(PERSONAS_CURATED_DIR / f"{persona}.jsonl")
        gguf_ok   = (PERSONAS_EXPO_DIR / f"{persona}.gguf").exists()
        if gguf_ok:
            icon = "🟢"
        elif curated_n >= 100:
            icon = "🟡"
        elif seed_n > 0:
            icon = "🔵"
        else:
            icon = "⚪"
        st.markdown(f"{icon} **{persona}** — {curated_n} curated")

    st.divider()
    if st.button("🔄 Refresh", use_container_width=True):
        st.rerun()
    st.caption("Status refreshes on every button click or page load.")


# ════════════════════════════════════════════════════════════════════════════════
# MAIN TABS
# ════════════════════════════════════════════════════════════════════════════════

tab_vision, tab_persona, tab_status = st.tabs([
    "🦋  Vision Classifier",
    "🧠  Persona Training",
    "📦  Model Status",
])


# ════════════════════════════════════════════════════════════════════════════════
# TAB 1 · VISION CLASSIFIER
# ════════════════════════════════════════════════════════════════════════════════

with tab_vision:
    st.header("Vision Classifier Pipeline")
    st.markdown(
        "EfficientNetV2-S fine-tuned on Central European insect photos.  \n"
        "Four steps: **Download → Train → Test → Export**."
    )

    # ── Step 1: Download ──────────────────────────────────────────────────────

    with st.expander("### Step 1 · Download Dataset", expanded=not data_exists):
        left, right = st.columns([3, 2])

        with left:
            st.markdown(
                "Fetches research-grade photos from iNaturalist API.  \n"
                "~20 species × 150 images ≈ **~2 GB total**, takes **15–30 min**."
            )

            manifest_path = LOCAL_META_DIR / "species_manifest.json"
            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text())

                def _img_count(tid: int) -> int:
                    d = LOCAL_DATA_DIR / str(tid)
                    if not d.exists():
                        return 0
                    return len([f for f in d.iterdir() if f.is_file()])

                sp_rows = [
                    {
                        "Common Name": m["common_name"],
                        "Scientific Name": m["scientific_name"],
                        "Taxon ID": m["taxon_id"],
                        "Images": _img_count(m["taxon_id"]),
                    }
                    for m in manifest
                ]
                df_sp = pd.DataFrame(sp_rows)
                st.dataframe(df_sp, use_container_width=True, hide_index=True, height=300)

                total_imgs = int(df_sp["Images"].sum())
                n_complete = int((df_sp["Images"] >= 100).sum())
                c1, c2, c3 = st.columns(3)
                c1.metric("Species", len(df_sp))
                c2.metric("Total Images", total_imgs)
                c3.metric("Complete Species", f"{n_complete}/{len(df_sp)}")
            else:
                st.info("No manifest yet. Run the download to see the species list.")

        with right:
            st.markdown("**What gets downloaded**")
            st.markdown(
                "- 20 visually distinct Central EU insects\n"
                "- Research-grade iNat observations only\n"
                "- European bounding box (lat 34–71, lon −25–45)\n"
                "- Parallel downloads with retry logic"
            )
            st.markdown("**Output directory**")
            st.code(str(LOCAL_DATA_DIR.relative_to(ROOT_DIR)), language="")

            if st.button("⬇️  Download Dataset", type="primary", key="btn_dl",
                         use_container_width=True):
                run_script(
                    [sys.executable, "01_setup_and_download.py"],
                    cwd=LOCAL_DIR,
                    spinner_text="Downloading dataset… (15–30 min, check console for progress)",
                )
                st.rerun()

    # ── Step 2: Train ─────────────────────────────────────────────────────────

    with st.expander("### Step 2 · Train Model", expanded=data_exists and not ckpt_exists):
        left, right = st.columns([3, 2])

        with left:
            st.markdown(
                "Two-phase EfficientNetV2-S fine-tune:  \n"
                "• **Phase 1** — head-only warm-up (frozen backbone)  \n"
                "• **Phase 2** — full fine-tune with cosine LR decay  \n\n"
                "Runtime: ~**30–40 min** on M2 Mac (MPS), ~**2–4 h** on CPU."
            )

            if not data_exists:
                st.warning("⚠️  Dataset not found — complete Step 1 first.")

            with st.form("train_config_form"):
                st.markdown("**Hyperparameters** *(passed to training script via env vars)*")
                c1, c2, c3 = st.columns(3)
                with c1:
                    f_batch  = st.number_input("Batch size",     value=32,  min_value=4,   max_value=256, step=4)
                    f_epochs = st.number_input("Total epochs",   value=20,  min_value=3,   max_value=200)
                with c2:
                    f_warmup = st.number_input("Warmup epochs",  value=3,   min_value=1,   max_value=20)
                    f_lr     = st.number_input("Learning rate",  value=3e-4, format="%.0e", step=1e-4,
                                               min_value=1e-5, max_value=1e-2)
                with c3:
                    f_imgsize   = st.number_input("Image size",      value=224, min_value=128, max_value=512, step=32)
                    f_minimages = st.number_input("Min images/class",value=30,  min_value=5,   max_value=200)

                mps_fallback = st.checkbox(
                    "PYTORCH_ENABLE_MPS_FALLBACK (macOS — fixes some MPS ops)",
                    value=sys.platform == "darwin",
                )

                submitted = st.form_submit_button(
                    "🚀  Start Training",
                    type="primary",
                    disabled=not data_exists,
                )

            if submitted and data_exists:
                env_patch: dict[str, str] = {
                    "CB_BATCH_SIZE":    str(int(f_batch)),
                    "CB_EPOCHS":        str(int(f_epochs)),
                    "CB_WARMUP_EPOCHS": str(int(f_warmup)),
                    "CB_LR":            str(f_lr),
                    "CB_IMAGE_SIZE":    str(int(f_imgsize)),
                    "CB_MIN_IMAGES":    str(int(f_minimages)),
                }
                if mps_fallback:
                    env_patch["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
                run_script(
                    [sys.executable, "02_train.py"],
                    cwd=LOCAL_DIR,
                    env=env_patch,
                    spinner_text="Training… (30–40 min on M2, longer on CPU)",
                )
                st.rerun()

        with right:
            st.markdown("**Training curve**")
            history_path = LOCAL_CKPT_DIR / "history.json"
            if history_path.exists():
                h = json.loads(history_path.read_text())
                if h:
                    df_h = pd.DataFrame(h)
                    st.line_chart(
                        df_h.set_index("epoch")[["train_acc", "top1_acc", "top3_acc"]],
                        use_container_width=True,
                        height=220,
                    )
                    best = df_h.loc[df_h["top1_acc"].idxmax()]
                    c1, c2 = st.columns(2)
                    c1.metric("Best epoch",  int(best["epoch"]))
                    c2.metric("Top-1 acc",   f"{best['top1_acc']:.1%}")
                    c1.metric("Top-3 acc",   f"{best['top3_acc']:.1%}")
                    c2.metric("Train acc",   f"{best['train_acc']:.1%}")
            else:
                st.info("Training history will appear here once Step 2 completes.")

            if ckpt_exists:
                st.success(f"✅ Checkpoint exists  ({file_size_str(LOCAL_CKPT_DIR / 'best_model.pth')})")

    # ── Step 3: Inference test ─────────────────────────────────────────────────

    with st.expander("### Step 3 · Test Inference", expanded=False):
        if not ckpt_exists:
            st.warning("⚠️  No checkpoint found — complete Step 2 first.")
        else:
            left, right = st.columns(2)

            with left:
                st.markdown("**Upload an insect photo or use a dataset sample**")
                uploaded = st.file_uploader(
                    "Insect photo", type=["jpg", "jpeg", "png", "webp"], key="v_upload",
                )
                top_k     = st.slider("Top-K predictions", 1, 5, 3, key="v_topk")
                use_demo  = st.checkbox("Use random dataset image (--demo)", key="v_demo")

                if uploaded:
                    st.image(uploaded, caption="Uploaded image", use_container_width=True)

                can_run = bool(uploaded) or use_demo
                run_infer = st.button(
                    "🔍  Identify", type="primary", key="btn_infer", disabled=not can_run,
                )

            with right:
                st.markdown("**Predictions**")

                if run_infer and can_run:
                    tmp_path = None
                    if uploaded:
                        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                            tmp.write(uploaded.getvalue())
                            tmp_path = tmp.name
                        cmd = [sys.executable, "03_inference_test.py",
                               "--image", tmp_path, "--top", str(top_k)]
                    else:
                        cmd = [sys.executable, "03_inference_test.py",
                               "--demo", "--top", str(top_k)]

                    rc, output = run_script(
                        cmd, cwd=LOCAL_DIR, spinner_text="Running inference…"
                    )
                    if tmp_path:
                        try:
                            os.unlink(tmp_path)
                        except OSError:
                            pass

                    # Parse: "  #1  87.3%  ████████  Apis mellifera"
                    preds = []
                    for line in output.splitlines():
                        m = re.match(r"\s+#(\d+)\s+([\d.]+)%\s+[█\s]*\s+(.+)", line)
                        if m:
                            preds.append({
                                "rank":       int(m.group(1)),
                                "confidence": float(m.group(2)),
                                "species":    m.group(3).strip(),
                            })
                    if preds:
                        st.session_state["v_last_preds"] = preds

                preds = st.session_state.get("v_last_preds", [])
                if preds:
                    for p in preds:
                        conf_frac = p["confidence"] / 100
                        st.progress(
                            conf_frac,
                            text=f"#{p['rank']}  {p['species']}  —  {p['confidence']:.1f}%",
                        )
                    st.caption("Values from most recent identification")
                else:
                    st.info("Run identification to see predictions here.")

    # ── Step 4: Export ────────────────────────────────────────────────────────

    with st.expander("### Step 4 · Export for Mobile", expanded=False):
        st.markdown(
            "Converts the best checkpoint to `.onnx` (Android) and `.mlpackage` (iOS).  \n"
            "After exporting, copy to `assets/models/` and flip `USE_NATIVE_VISION = true` "
            "in `src/ai/index.ts`."
        )

        if not ckpt_exists:
            st.warning("⚠️  No checkpoint — complete Step 2 first.")
        else:
            c_files, c_actions = st.columns([2, 1])

            with c_files:
                st.markdown("**Export targets**")
                for path, label in [
                    (LOCAL_EXPO_DIR / "insect_classifier.onnx",     "ONNX — Android (ONNX Runtime)"),
                    (LOCAL_EXPO_DIR / "insect_classifier.mlpackage", "CoreML — iOS (Vision framework)"),
                    (LOCAL_CKPT_DIR / "class_map.json",              "class_map.json — label index"),
                ]:
                    exists = path.exists()
                    size   = file_size_str(path) if exists else ""
                    st.markdown(
                        f"{tick(exists)} `{path.name}` — {label}"
                        + (f"  \n&nbsp;&nbsp;&nbsp;&nbsp;{size}" if size else "")
                    )

            with c_actions:
                if st.button("📦  Export Models", type="primary", key="btn_export_v",
                             use_container_width=True):
                    run_script(
                        [sys.executable, "04_export.py"],
                        cwd=LOCAL_DIR,
                        spinner_text="Exporting to ONNX + CoreML…",
                    )
                    st.rerun()

                onnx_ready = (LOCAL_EXPO_DIR / "insect_classifier.onnx").exists()
                if onnx_ready:
                    if st.button("📋  Copy to assets/models/", key="btn_copy_v",
                                 use_container_width=True):
                        MODELS_DIR.mkdir(parents=True, exist_ok=True)
                        for src, dst in [
                            (LOCAL_EXPO_DIR / "insect_classifier.onnx",
                             MODELS_DIR / "insect_classifier.onnx"),
                            (LOCAL_CKPT_DIR / "class_map.json",
                             MODELS_DIR / "class_map.json"),
                        ]:
                            if src.exists():
                                shutil.copy2(src, dst)
                        mlpkg_src = LOCAL_EXPO_DIR / "insect_classifier.mlpackage"
                        if mlpkg_src.exists():
                            shutil.copytree(
                                mlpkg_src,
                                MODELS_DIR / "insect_classifier.mlpackage",
                                dirs_exist_ok=True,
                            )
                        st.success("✅ Copied to assets/models/!")
                        st.rerun()

                    st.markdown("---")
                    st.markdown("**Next step in app:**")
                    st.code(
                        "// src/ai/index.ts\nUSE_NATIVE_VISION = true",
                        language="typescript",
                    )


# ════════════════════════════════════════════════════════════════════════════════
# TAB 2 · PERSONA TRAINING
# ════════════════════════════════════════════════════════════════════════════════

with tab_persona:
    st.header("Persona LoRA Training")
    st.markdown(
        "Per-persona LoRA adapters on top of **Llama-3.2-1B-Instruct**.  \n"
        "Five steps: **Seed → Curate → Train → Test → Export**."
    )
    st.info(
        "💡 Only start this pipeline after the system-prompt approach shows noticeable "
        "drift in real user testing — see `docs/ml-roadmap.md` § Track 2 for the decision criteria.",
        icon="💡",
    )

    # ── Step 1: Seed generation ───────────────────────────────────────────────

    with st.expander("### Step 1 · Generate Seed Examples", expanded=True):
        st.markdown(
            "Bootstraps ~80 dialogue examples per persona using the Anthropic API.  \n"
            "Reads system prompts directly from `src/personas/index.ts` "
            "(the app's prompts are the ground truth).  \n"
            "Estimated cost: **~$1–3** with claude-haiku-4-5."
        )

        c_key, c_opts = st.columns(2)
        with c_key:
            api_key = st.text_input(
                "ANTHROPIC_API_KEY",
                type="password",
                placeholder="sk-ant-…",
                value=os.environ.get("ANTHROPIC_API_KEY", ""),
                help="Used only locally to call the Anthropic API. Never stored.",
            )
        with c_opts:
            seed_model = st.selectbox(
                "Model",
                options=["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
                index=0,
                help="Haiku is fastest & cheapest. Opus produces richer examples but costs more.",
            )
            seed_personas = st.multiselect(
                "Personas to seed", PERSONA_NAMES, default=PERSONA_NAMES,
            )

        c1, c2, c3 = st.columns(3)
        for col, persona in zip([c1, c2, c3], PERSONA_NAMES):
            n = jsonl_count(PERSONAS_SEED_DIR / f"{persona}.jsonl")
            col.metric(f"{persona.title()} seeds", n)

        if not api_key:
            st.warning("Enter your Anthropic API key above to enable seed generation.")
        elif not seed_personas:
            st.warning("Select at least one persona.")
        else:
            if st.button("🌱  Generate Seeds", type="primary", key="btn_seed"):
                run_script(
                    [sys.executable, "01_seed_examples.py",
                     "--personas", ",".join(seed_personas),
                     "--model", seed_model],
                    cwd=PERSONAS_DIR,
                    env={"ANTHROPIC_API_KEY": api_key},
                    spinner_text="Generating via Claude API… (~5–10 min)",
                )
                st.rerun()

    # ── Step 2: Curation ──────────────────────────────────────────────────────

    with st.expander("### Step 2 · Curate Examples", expanded=False):
        st.markdown(
            "Review each AI-generated example. Accept it as-is, edit it, or reject it.  \n"
            "**Target: 300 curated examples per persona** for stable fine-tuning.  \n"
            "This step is the real bottleneck — budget a full day of review time."
        )

        curate_persona = st.selectbox("Persona", PERSONA_NAMES, key="curate_persona_sel")

        seed_path    = PERSONAS_SEED_DIR    / f"{curate_persona}.jsonl"
        curated_path = PERSONAS_CURATED_DIR / f"{curate_persona}.jsonl"
        seed_rows    = load_jsonl(seed_path)
        curated_rows = load_jsonl(curated_path)

        c1, c2, c3 = st.columns(3)
        c1.metric("Seed examples", len(seed_rows))
        c2.metric("Curated",       len(curated_rows))
        c3.metric("Target",        300)

        if curated_rows:
            st.progress(
                min(len(curated_rows) / 300, 1.0),
                text=f"{len(curated_rows)} / 300  ({len(curated_rows)/300*100:.0f}%)",
            )

        if not seed_rows:
            st.info("No seed examples yet — run Step 1 first.")
        else:
            idx_key = f"curate_idx_{curate_persona}"
            if idx_key not in st.session_state:
                st.session_state[idx_key] = 0

            idx = max(0, min(int(st.session_state[idx_key]), len(seed_rows) - 1))
            current = seed_rows[idx]

            st.divider()
            c_prog, c_nav = st.columns([3, 1])
            with c_prog:
                st.progress(
                    (idx + 1) / len(seed_rows),
                    text=f"Example {idx + 1} of {len(seed_rows)} — use arrows or jump below",
                )
            with c_nav:
                new_idx = st.number_input(
                    "Jump to #", min_value=1, max_value=len(seed_rows),
                    value=idx + 1, key=f"nav_{curate_persona}",
                    label_visibility="collapsed",
                )
                if int(new_idx) - 1 != idx:
                    st.session_state[idx_key] = int(new_idx) - 1
                    st.rerun()

            st.markdown("**Question (instruction)**")
            st.info(current.get("instruction", ""), icon="💬")

            edited_output = st.text_area(
                "Response — edit if needed, then Accept",
                value=current.get("output", ""),
                height=140,
                key=f"edit_{curate_persona}_{idx}",
            )

            c_acc, c_rej, c_skip = st.columns(3)

            with c_acc:
                if st.button("✅  Accept", key=f"acc_{curate_persona}_{idx}",
                             use_container_width=True, type="primary"):
                    curated_rows.append({
                        "instruction": current["instruction"],
                        "input":       "",
                        "output":      edited_output,
                    })
                    save_jsonl(curated_path, curated_rows)
                    st.session_state[idx_key] = min(idx + 1, len(seed_rows) - 1)
                    st.rerun()

            with c_rej:
                if st.button("❌  Reject", key=f"rej_{curate_persona}_{idx}",
                             use_container_width=True):
                    st.session_state[idx_key] = min(idx + 1, len(seed_rows) - 1)
                    st.rerun()

            with c_skip:
                if st.button("⏭️  Skip for now", key=f"skip_{curate_persona}_{idx}",
                             use_container_width=True):
                    st.session_state[idx_key] = min(idx + 1, len(seed_rows) - 1)
                    st.rerun()

            # Browse saved curated examples
            if curated_rows:
                with st.expander(f"Browse saved curated examples ({len(curated_rows)})"):
                    df_cur = pd.DataFrame(curated_rows)
                    if "instruction" in df_cur.columns and "output" in df_cur.columns:
                        st.dataframe(
                            df_cur[["instruction", "output"]].rename(
                                columns={"instruction": "Question", "output": "Response"}
                            ),
                            use_container_width=True,
                            hide_index=True,
                            height=300,
                        )
                    csv_bytes = df_cur.to_csv(index=False).encode()
                    st.download_button(
                        "⬇️ Export curated as CSV",
                        data=csv_bytes,
                        file_name=f"{curate_persona}_curated.csv",
                        mime="text/csv",
                    )

    # ── Step 3: LoRA training ─────────────────────────────────────────────────

    with st.expander("### Step 3 · Train LoRA Adapters", expanded=False):
        st.markdown(
            "Trains one 15 MB LoRA adapter per persona on top of Llama-3.2-1B-Instruct.  \n"
            "Best on Kaggle T4 GPU (`training/personas/kaggle/`). Works on M-series Mac (slower).  \n"
            "Hot-swappable at runtime — base model stays loaded between persona switches."
        )

        curated_counts = {
            p: jsonl_count(PERSONAS_CURATED_DIR / f"{p}.jsonl")
            for p in PERSONA_NAMES
        }

        c1, c2, c3 = st.columns(3)
        for col, (persona, count) in zip([c1, c2, c3], curated_counts.items()):
            icon = "🟢" if count >= 300 else ("🟡" if count >= 100 else "🔴")
            col.metric(f"{icon} {persona.title()}", f"{count} examples",
                       delta="ready" if count >= 100 else "need more")

        with st.form("lora_config_form"):
            st.markdown("**LoRA config**")
            c_cfg1, c_cfg2 = st.columns(2)
            with c_cfg1:
                lora_r      = st.number_input("Rank (r)",       value=8,   min_value=2,   max_value=64)
                lora_alpha  = st.number_input("Alpha",          value=16,  min_value=4,   max_value=256)
                lora_epochs = st.number_input("Epochs",         value=3,   min_value=1,   max_value=20)
            with c_cfg2:
                lora_lr  = st.number_input("Learning rate",  value=2e-4, format="%.0e",
                                           min_value=1e-5, max_value=1e-2)
                lora_bs  = st.number_input("Batch size",     value=4,   min_value=1,   max_value=64)

            mps_lora = st.checkbox(
                "PYTORCH_ENABLE_MPS_FALLBACK (macOS)", value=sys.platform == "darwin"
            )

            eligible_personas = [p for p, c in curated_counts.items() if c >= 30]
            train_personas = st.multiselect(
                "Personas to train (need ≥ 30 curated each)",
                options=eligible_personas,
                default=eligible_personas,
            )

            start_lora = st.form_submit_button(
                "🚀  Start LoRA Training",
                type="primary",
                disabled=not eligible_personas or not train_personas,
            )

        if not eligible_personas:
            st.warning("⚠️  No persona has ≥ 30 curated examples — complete Step 2 first.")

        if start_lora and train_personas:
            env_lora: dict[str, str] = {}
            if mps_lora:
                env_lora["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
            run_script(
                [sys.executable, "03_train_lora.py"],
                cwd=PERSONAS_DIR,
                env=env_lora,
                spinner_text="Training LoRA adapters… (may take hours on CPU)",
            )
            st.rerun()

    # ── Step 4: Inference test ─────────────────────────────────────────────────

    with st.expander("### Step 4 · Test Persona Inference", expanded=False):
        st.markdown(
            "Side-by-side comparison: **base model + system prompt** vs "
            "**base model + LoRA adapter**.  \n"
            "Use this to verify the adapter actually shifts the voice as intended."
        )

        c_inp, c_out = st.columns(2)
        with c_inp:
            test_persona = st.selectbox("Persona", PERSONA_NAMES, key="p_test_sel")
            test_prompt  = st.text_area(
                "Question",
                value="What's the difference between a moth and a butterfly?",
                height=100,
                key="p_test_prompt",
            )
            run_p_test = st.button("🔬  Run Comparison", key="btn_p_test", type="primary")

        with c_out:
            st.markdown("**Script output**")
            if run_p_test:
                run_script(
                    [sys.executable, "04_inference_test.py",
                     "--persona", test_persona,
                     "--prompt", test_prompt],
                    cwd=PERSONAS_DIR,
                    spinner_text="Running inference comparison…",
                )

    # ── Step 5: Export adapters ────────────────────────────────────────────────

    with st.expander("### Step 5 · Export GGUF Adapters", expanded=False):
        st.markdown(
            "Converts LoRA safetensors → GGUF adapter format for `llama.rn`.  \n"
            "~15 MB per adapter, hot-swappable without reloading the base model."
        )

        c_files, c_btn = st.columns([2, 1])
        ckpts_any = False

        with c_files:
            for persona in PERSONA_NAMES:
                ckpt_ok = (PERSONAS_CKPT_DIR / persona).exists()
                gguf_ok = (PERSONAS_EXPO_DIR / f"{persona}.gguf").exists()
                if ckpt_ok:
                    ckpts_any = True
                gguf_size = file_size_str(PERSONAS_EXPO_DIR / f"{persona}.gguf") if gguf_ok else ""
                st.markdown(
                    f"{tick(ckpt_ok)} Checkpoint: `checkpoints/{persona}/`  \n"
                    f"{tick(gguf_ok)} GGUF: `exported/{persona}.gguf`"
                    + (f"  ({gguf_size})" if gguf_size else "")
                )

        with c_btn:
            if not ckpts_any:
                st.warning("⚠️  No checkpoints — complete Step 3 first.")
            else:
                if st.button("📦  Export Adapters", type="primary", key="btn_export_p",
                             use_container_width=True):
                    run_script(
                        [sys.executable, "05_export_adapters.py"],
                        cwd=PERSONAS_DIR,
                        spinner_text="Exporting GGUF adapters…",
                    )
                    st.rerun()

                all_ggufs = all(
                    (PERSONAS_EXPO_DIR / f"{p}.gguf").exists()
                    for p in PERSONA_NAMES
                )
                if all_ggufs:
                    if st.button("📋  Copy to assets/models/", key="btn_copy_p",
                                 use_container_width=True):
                        MODELS_DIR.mkdir(parents=True, exist_ok=True)
                        for persona in PERSONA_NAMES:
                            src = PERSONAS_EXPO_DIR / f"{persona}.gguf"
                            if src.exists():
                                shutil.copy2(src, MODELS_DIR / f"{persona}.gguf")
                        st.success("✅ All adapters copied to assets/models/!")
                        st.rerun()


# ════════════════════════════════════════════════════════════════════════════════
# TAB 3 · MODEL STATUS
# ════════════════════════════════════════════════════════════════════════════════

with tab_status:
    st.header("Model Status & Files")

    c_hdr, c_refresh = st.columns([5, 1])
    with c_refresh:
        if st.button("🔄 Refresh", key="btn_refresh_status", use_container_width=True):
            st.rerun()

    # ── assets/models/ ────────────────────────────────────────────────────────

    st.subheader(f"📁 `{MODELS_DIR.relative_to(ROOT_DIR)}/`")

    expected_models = [
        ("insect_classifier.onnx",             "Android vision classifier",              False),
        ("insect_classifier.mlpackage",         "iOS vision classifier",                  False),
        ("class_map.json",                      "Label → species mapping",                False),
        ("llama-3.2-1b-instruct-q4_k_m.gguf",  "Base LLM — download separately (~800 MB)", True),
        ("larva.gguf",                          "Larva persona adapter (~15 MB)",         False),
        ("snail.gguf",                          "Snail persona adapter (~15 MB)",         False),
        ("maywind.gguf",                        "Maywind persona adapter (~15 MB)",       False),
    ]

    asset_rows = []
    for fname, desc, manual in expected_models:
        path   = MODELS_DIR / fname
        exists = path.exists()
        size   = file_size_str(path) if exists else "—"
        if exists:
            status = "✅ Present"
        elif manual:
            status = "⚠️ Download manually"
        else:
            status = "❌ Missing"
        asset_rows.append({"File": fname, "Description": desc, "Status": status, "Size": size})

    st.dataframe(pd.DataFrame(asset_rows), use_container_width=True, hide_index=True)

    if not any((MODELS_DIR / f).exists() for f, *_ in expected_models):
        st.info(
            "No model files yet. Complete both pipelines and use the "
            "'Copy to assets/models/' buttons in the tabs above."
        )

    # ── Manual LLM download note ─────────────────────────────────────────────

    with st.expander("How to get the base LLM weights"):
        st.markdown("""
The base LLM (`llama-3.2-1b-instruct-q4_k_m.gguf`, ~800 MB) must be downloaded manually
from the Hugging Face hub since it's too large to include in training scripts:

```bash
# Option A: huggingface-cli
pip install huggingface_hub
huggingface-cli download bartowski/Llama-3.2-1B-Instruct-GGUF \\
    Llama-3.2-1B-Instruct-Q4_K_M.gguf \\
    --local-dir assets/models/ \\
    --local-dir-use-symlinks False

# Rename to match expected filename:
mv assets/models/Llama-3.2-1B-Instruct-Q4_K_M.gguf \\
   assets/models/llama-3.2-1b-instruct-q4_k_m.gguf
```
""")

    # ── Vision training artifacts ──────────────────────────────────────────────

    st.subheader("🦋 Vision Training Artifacts")

    v_artifacts = [
        LOCAL_DATA_DIR,
        LOCAL_META_DIR / "species_manifest.json",
        LOCAL_CKPT_DIR / "best_model.pth",
        LOCAL_CKPT_DIR / "class_map.json",
        LOCAL_CKPT_DIR / "history.json",
        LOCAL_EXPO_DIR / "insect_classifier.onnx",
        LOCAL_EXPO_DIR / "insect_classifier.mlpackage",
    ]

    v_rows = []
    for path in v_artifacts:
        exists = path.exists()
        v_rows.append({
            "Path": str(path.relative_to(ROOT_DIR)),
            "Status": tick(exists),
            "Size": file_size_str(path) if exists else "—",
        })
    st.dataframe(pd.DataFrame(v_rows), use_container_width=True, hide_index=True)

    history_path = LOCAL_CKPT_DIR / "history.json"
    if history_path.exists():
        h = json.loads(history_path.read_text())
        if h:
            df_h = pd.DataFrame(h)
            c_chart, c_metrics = st.columns([3, 1])
            with c_chart:
                st.markdown("**Training curve**")
                st.line_chart(
                    df_h.set_index("epoch")[["train_acc", "top1_acc", "top3_acc"]],
                    use_container_width=True,
                    height=220,
                )
            with c_metrics:
                best = df_h.loc[df_h["top1_acc"].idxmax()]
                st.metric("Best epoch", int(best["epoch"]))
                st.metric("Top-1 acc",  f"{best['top1_acc']:.1%}")
                st.metric("Top-3 acc",  f"{best['top3_acc']:.1%}")
                last = df_h.iloc[-1]
                st.metric("Train epochs", int(last["epoch"]))

    # ── Persona training artifacts ─────────────────────────────────────────────

    st.subheader("🧠 Persona Training Artifacts")

    p_rows = []
    for persona in PERSONA_NAMES:
        seed_n    = jsonl_count(PERSONAS_SEED_DIR    / f"{persona}.jsonl")
        curated_n = jsonl_count(PERSONAS_CURATED_DIR / f"{persona}.jsonl")
        ckpt_ok   = (PERSONAS_CKPT_DIR / persona).exists()
        gguf_ok   = (PERSONAS_EXPO_DIR / f"{persona}.gguf").exists()
        pct       = min(curated_n / 300 * 100, 100)
        p_rows.append({
            "Persona":       persona.title(),
            "Seed examples": seed_n,
            "Curated":       curated_n,
            "Progress":      f"{pct:.0f}%",
            "Checkpoint":    tick(ckpt_ok),
            "GGUF":          tick(gguf_ok),
        })

    st.dataframe(pd.DataFrame(p_rows), use_container_width=True, hide_index=True)

    # ── Environment check ──────────────────────────────────────────────────────

    st.subheader("⚙️ Environment")

    c_sys1, c_sys2 = st.columns(2)

    with c_sys1:
        st.markdown(f"**Python** `{sys.version.split()[0]}`  \n**Platform** `{sys.platform}`")
        try:
            import torch
            if torch.backends.mps.is_available():
                accel = "✅ Apple MPS (M-series GPU)"
            elif torch.cuda.is_available():
                accel = f"✅ CUDA — {torch.cuda.get_device_name(0)}"
            else:
                accel = "⚠️ CPU only (training will be slow)"
            st.markdown(f"**PyTorch** ✅ `{torch.__version__}`  \n**Accelerator** {accel}")
        except ImportError:
            st.markdown("**PyTorch** ❌ not installed")
            st.code("pip install -r training/local/requirements.txt", language="bash")

    with c_sys2:
        for pkg, label in [
            ("timm",          "timm (vision models)"),
            ("transformers",  "Transformers"),
            ("peft",          "PEFT (LoRA)"),
            ("anthropic",     "Anthropic SDK"),
            ("coremltools",   "CoreML Tools"),
            ("onnxruntime",   "ONNX Runtime"),
        ]:
            try:
                mod = __import__(pkg)
                ver = getattr(mod, "__version__", "installed")
                st.markdown(f"✅ **{label}** `{ver}`")
            except ImportError:
                st.markdown(f"❌ **{label}** — not installed")

    with st.expander("Install dependencies"):
        st.markdown("**Vision classifier requirements:**")
        st.code("pip install -r training/local/requirements.txt", language="bash")
        st.markdown("**Persona training requirements:**")
        st.code("pip install -r training/personas/requirements.txt", language="bash")
        st.markdown("**This dashboard:**")
        st.code("pip install -r tools/training-ui/requirements.txt", language="bash")
