"""
Critterboard Training Dashboard
=================================
Streamlit GUI for training the vision classifier and persona LoRA adapters,
plus live insect identification using the trained model.

Run from anywhere in the repo:
    streamlit run tools/training-ui/app.py
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
from PIL import Image

# ── Path constants ─────────────────────────────────────────────────────────────
TOOL_DIR     = Path(__file__).resolve().parent
ROOT_DIR     = TOOL_DIR.parent.parent
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

# ── Load insect data module ────────────────────────────────────────────────────
sys.path.insert(0, str(LOCAL_DIR))
try:
    from insect_data import SPECIES_DATA, SPECIES_BY_SCIENTIFIC, SPECIES_BY_COMMON, get_by_label
    INSECT_DATA_AVAILABLE = True
except ImportError:
    INSECT_DATA_AVAILABLE = False
    SPECIES_DATA = []

# ── Optional torch import (needed for inference only) ─────────────────────────
try:
    import torch
    import torch.nn as nn
    import torchvision.models as tv_models
    import torchvision.transforms as T
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

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
    [data-testid="metric-container"] { padding: 4px 0; }
    .step-caption { color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .stCodeBlock { max-height: 400px; overflow-y: auto; }
    .species-card {
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        background: #1e293b;
    }
    .source-chip {
        display: inline-block;
        background: #1e3a5f;
        border-radius: 4px;
        padding: 2px 8px;
        margin: 2px;
        font-size: 0.8rem;
    }
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
# INFERENCE HELPERS
# ════════════════════════════════════════════════════════════════════════════════

def _find_model_and_class_map() -> tuple[Path | None, Path | None]:
    """Locate the best available trained model and its class map."""
    candidates = [
        (LOCAL_CKPT_DIR / "best_model_lite.pth", LOCAL_CKPT_DIR / "class_map_lite.json"),
        (LOCAL_CKPT_DIR / "best_model.pth",       LOCAL_CKPT_DIR / "class_map.json"),
    ]
    for model_path, cm_path in candidates:
        if model_path.exists() and cm_path.exists():
            return model_path, cm_path
    return None, None


@st.cache_resource
def load_classifier():
    """Load the trained model. Cached across Streamlit reruns."""
    if not TORCH_AVAILABLE:
        return None, None, "PyTorch not installed."

    model_path, cm_path = _find_model_and_class_map()
    if model_path is None:
        return None, None, "No trained model found. Train one first."

    try:
        class_map: dict = json.loads(cm_path.read_text())
        num_classes = len(class_map)

        ckpt = torch.load(model_path, map_location="cpu", weights_only=False)
        arch = ckpt.get("model_arch", "mobilenet_v3_small")

        if arch == "mobilenet_v3_small":
            model = tv_models.mobilenet_v3_small(weights=None)
            in_features = model.classifier[-1].in_features
            model.classifier[-1] = nn.Linear(in_features, num_classes)
        else:
            # EfficientNetV2-S from full training pipeline (uses timm)
            try:
                import timm
                model = timm.create_model(
                    "efficientnetv2_s", pretrained=False, num_classes=num_classes
                )
            except ImportError:
                return None, None, "timm not installed; needed for efficientnetv2_s."

        model.load_state_dict(ckpt["model_state"])
        model.eval()
        return model, class_map, None
    except Exception as exc:
        return None, None, f"Failed to load model: {exc}"


def predict_image(pil_img: Image.Image, top_k: int = 3) -> list[dict]:
    """
    Run the trained classifier on a PIL image.
    Returns list of dicts: [{label, confidence, species_info}, …].
    """
    model, class_map, err = load_classifier()
    if model is None:
        return []

    transform = T.Compose([
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    tensor = transform(pil_img.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        logits = model(tensor)
        probs  = torch.softmax(logits, dim=1)[0]

    k = min(top_k, len(class_map))
    top_idx = probs.argsort(descending=True)[:k].tolist()

    results = []
    for idx in top_idx:
        label = class_map.get(str(idx), f"Class {idx}")
        conf  = probs[idx].item()
        info  = get_by_label(label) if INSECT_DATA_AVAILABLE else None
        results.append({"label": label, "confidence": conf, "species_info": info})
    return results


# ════════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ════════════════════════════════════════════════════════════════════════════════

data_exists  = dir_has_files(LOCAL_DATA_DIR)
ckpt_lite    = (LOCAL_CKPT_DIR / "best_model_lite.pth").exists()
ckpt_full    = (LOCAL_CKPT_DIR / "best_model.pth").exists()
ckpt_exists  = ckpt_lite or ckpt_full
onnx_exists  = (LOCAL_EXPO_DIR / "insect_classifier.onnx").exists()
mlpkg_exists = (LOCAL_EXPO_DIR / "insect_classifier.mlpackage").exists()

with st.sidebar:
    st.markdown("## 🦗 Critterboard\n### Training Dashboard")
    st.caption(f"`{ROOT_DIR.name}/`")
    st.divider()

    st.markdown("**Vision Classifier**")
    for ok, label in [
        (data_exists,   "Dataset downloaded"),
        (ckpt_lite,     "Lite model  (MobileNetV3)"),
        (ckpt_full,     "Full model  (EfficientNetV2)"),
        (onnx_exists,   "ONNX export"),
        (mlpkg_exists,  "CoreML export"),
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

tab_identify, tab_guide, tab_vision, tab_persona, tab_status = st.tabs([
    "🔍  Identify",
    "📚  Species Guide",
    "🦋  Vision Classifier",
    "🧠  Persona Training",
    "📦  Model Status",
])


# ════════════════════════════════════════════════════════════════════════════════
# TAB 1 · IDENTIFY
# ════════════════════════════════════════════════════════════════════════════════

with tab_identify:
    st.header("🔍 Identify an Insect")
    st.markdown(
        "Upload a photo and the trained classifier will suggest which of the "
        "**20 common Central European insect species** it might be, along with "
        "detailed species information."
    )

    # ── Status check ─────────────────────────────────────────────────────────
    model, class_map_loaded, model_err = load_classifier()

    if not TORCH_AVAILABLE:
        st.error(
            "PyTorch is not installed in this environment.  \n"
            "Install it with:  \n"
            "```bash\npip install torch torchvision\n```"
        )
    elif model is None:
        st.warning(
            "No trained model found yet. "
            "Go to the **🦋 Vision Classifier** tab and run **Quick Train** "
            "to train a model in ~15–30 minutes on CPU, or run the full "
            "pipeline for higher accuracy."
        )
        if st.button("→ Go to Vision Classifier tab", key="goto_vc"):
            st.info("Click the **🦋 Vision Classifier** tab above.")
    else:
        arch_label = "MobileNetV3-Small (lite)" if ckpt_lite else "EfficientNetV2-S (full)"
        # Detect if this was trained on synthetic demo data
        demo_data = (LOCAL_DATA_DIR / "47219" / "demo_0000.jpg").exists()
        if demo_data and not ckpt_full:
            st.warning(
                f"Model loaded: **{arch_label}** — {len(class_map_loaded)} classes  \n"
                "⚠️ **Demo model:** Trained on synthetic images — will classify "
                "the synthetic colour-pattern images correctly but will NOT identify "
                "real insect photos accurately.  "
                "Retrain with real iNaturalist data for live identification.",
                icon="⚠️",
            )
        else:
            st.success(f"Model loaded: **{arch_label}** — {len(class_map_loaded)} classes")

    st.divider()

    col_upload, col_results = st.columns([1, 1])

    with col_upload:
        st.subheader("Upload photo")
        uploaded = st.file_uploader(
            "Insect photo", type=["jpg", "jpeg", "png", "webp"], key="id_upload",
            label_visibility="collapsed",
        )
        top_k = st.slider("Show top predictions", 1, 5, 3, key="id_topk")

        if uploaded:
            pil_img = Image.open(uploaded).convert("RGB")
            st.image(pil_img, caption="Uploaded image", use_container_width=True)

        run_id = st.button(
            "🔍  Identify", type="primary", key="btn_identify",
            disabled=(not uploaded or model is None),
            use_container_width=True,
        )

        if run_id and uploaded:
            with st.spinner("Running classifier…"):
                preds = predict_image(pil_img, top_k=top_k)
            st.session_state["id_preds"] = preds

    with col_results:
        st.subheader("Predictions")
        preds = st.session_state.get("id_preds", [])

        if not preds and model is not None:
            st.info("Upload a photo and click **Identify** to see results.")
        elif preds:
            for rank, pred in enumerate(preds, 1):
                label = pred["label"]
                conf  = pred["confidence"]
                conf_pct = conf * 100
                emoji = "🥇" if rank == 1 else ("🥈" if rank == 2 else "🥉" if rank == 3 else f"#{rank}")
                st.progress(conf, text=f"{emoji}  **{label}**  —  {conf_pct:.1f}%")

    # ── Species detail for top prediction ─────────────────────────────────────
    preds = st.session_state.get("id_preds", [])
    if preds:
        st.divider()
        top_pred = preds[0]
        info = top_pred.get("species_info")

        if info:
            _render_species_detail(info) if "render" in dir() else None  # forward ref guard
            col_name, col_meta = st.columns([3, 2])
            with col_name:
                st.subheader(f"{info['common_name']}")
                st.markdown(f"*{info['scientific_name']}*  \n"
                            f"**Order:** {info['order']} | **Family:** {info['family']}")
            with col_meta:
                if info.get("size_mm"):
                    st.metric("Length", f"{info['size_mm']} mm")
                if info.get("wingspan_mm"):
                    st.metric("Wingspan", f"{info['wingspan_mm']} mm")
                status = info.get("conservation_status", "")
                if status:
                    colour = "green" if "Least" in status else ("orange" if "Near" in status else "red")
                    st.markdown(f"**Conservation:** :{colour}[{status}]")

            st.markdown("**Description**")
            st.markdown(info["description"])

            desc_cols = st.columns(2)
            with desc_cols[0]:
                if info.get("habitat"):
                    st.markdown("**Habitat**")
                    st.markdown(info["habitat"])
                if info.get("distribution"):
                    st.markdown("**Distribution**")
                    st.markdown(info["distribution"])
            with desc_cols[1]:
                if info.get("diet"):
                    st.markdown("**Diet**")
                    st.markdown(info["diet"])
                if info.get("behavior"):
                    st.markdown("**Behaviour**")
                    st.markdown(info["behavior"])

            if info.get("identification_tips"):
                st.info(f"🔎 **ID tips:** {info['identification_tips']}")

            if info.get("interesting_facts"):
                st.markdown("**Interesting facts**")
                for fact in info["interesting_facts"]:
                    st.markdown(f"- {fact}")

            if info.get("sources"):
                st.markdown("**Sources & further reading**")
                source_html = " ".join(
                    f'<a href="{s["url"]}" target="_blank" '
                    f'style="background:#1e3a5f;border-radius:4px;padding:3px 10px;'
                    f'margin:2px;display:inline-block;text-decoration:none;color:#93c5fd;">'
                    f'{s["name"]}</a>'
                    for s in info["sources"]
                )
                st.markdown(source_html, unsafe_allow_html=True)
        else:
            label = top_pred["label"]
            st.info(
                f"Top prediction: **{label}** ({top_pred['confidence']:.1%} confidence)  \n"
                "Detailed species information not available for this label."
            )


# ════════════════════════════════════════════════════════════════════════════════
# TAB 2 · SPECIES GUIDE
# ════════════════════════════════════════════════════════════════════════════════

with tab_guide:
    st.header("📚 Species Guide")
    st.markdown(
        "Reference guide for the **20 common Central European insect species** "
        "included in the classifier. Tap a species to expand full information."
    )

    if not INSECT_DATA_AVAILABLE:
        st.error(
            "Species data not found. Make sure `insect_data.py` is present in "
            f"`{LOCAL_DIR}`."
        )
    else:
        # Order filter
        orders = sorted({s["order"] for s in SPECIES_DATA})
        sel_orders = st.multiselect(
            "Filter by Order", orders, default=orders, key="guide_orders"
        )

        filtered = [s for s in SPECIES_DATA if s["order"] in sel_orders]
        st.caption(f"Showing {len(filtered)} of {len(SPECIES_DATA)} species")

        for sp in filtered:
            label = (
                f"**{sp['common_name']}** — *{sp['scientific_name']}*  "
                f"| {sp['order']} / {sp['family']}"
            )
            with st.expander(label):
                col_info, col_meta = st.columns([3, 1])

                with col_info:
                    st.markdown(sp["description"])

                    if sp.get("habitat"):
                        st.markdown(f"🌿 **Habitat:** {sp['habitat']}")
                    if sp.get("distribution"):
                        st.markdown(f"🗺️ **Distribution:** {sp['distribution']}")
                    if sp.get("diet"):
                        st.markdown(f"🍽️ **Diet:** {sp['diet']}")
                    if sp.get("behavior"):
                        st.markdown(f"🔄 **Behaviour:** {sp['behavior']}")
                    if sp.get("identification_tips"):
                        st.info(f"🔎 **ID tips:** {sp['identification_tips']}")

                with col_meta:
                    if sp.get("size_mm"):
                        st.metric("Length", f"{sp['size_mm']} mm")
                    if sp.get("wingspan_mm"):
                        st.metric("Wingspan", f"{sp['wingspan_mm']} mm")

                    status = sp.get("conservation_status", "")
                    if status:
                        if "Least" in status:
                            st.success(f"**{status}**")
                        elif "Near" in status or "Vulnerable" in status:
                            st.warning(f"**{status}**")
                        else:
                            st.error(f"**{status}**")

                    st.markdown(
                        f"[iNaturalist](https://www.inaturalist.org/taxa/{sp['taxon_id']})",
                    )

                if sp.get("interesting_facts"):
                    st.markdown("**Interesting facts**")
                    for fact in sp["interesting_facts"]:
                        st.markdown(f"- {fact}")

                if sp.get("sources"):
                    st.markdown("**Sources**")
                    for src in sp["sources"]:
                        st.markdown(f"- [{src['name']}]({src['url']})")


# ════════════════════════════════════════════════════════════════════════════════
# TAB 3 · VISION CLASSIFIER
# ════════════════════════════════════════════════════════════════════════════════

with tab_vision:
    st.header("Vision Classifier Pipeline")

    # ── Quick Train section (CPU/cloud friendly) ──────────────────────────────
    st.subheader("⚡ Quick Train (CPU-friendly)")
    st.markdown(
        "Trains a **MobileNetV3-Small** classifier using feature extraction — "
        "suitable for CPU-only environments including cloud containers.  \n"
        "**Total time: ~15–30 min** (mostly download).  "
        "Produces `best_model_lite.pth` used by the 🔍 Identify tab."
    )

    qt_col1, qt_col2 = st.columns([3, 2])

    with qt_col1:
        with st.form("quick_train_form"):
            c1, c2, c3 = st.columns(3)
            with c1:
                qt_images  = st.number_input("Images per class", value=40,  min_value=15, max_value=150, step=5)
                qt_epochs  = st.number_input("Epochs",           value=30,  min_value=5,  max_value=100)
            with c2:
                qt_bs      = st.number_input("Batch size",       value=32,  min_value=4,  max_value=128, step=4)
                qt_lr      = st.number_input("Learning rate",    value=1e-3, format="%.0e",
                                              min_value=1e-5, max_value=1e-1)
            with c3:
                qt_workers = st.number_input("Download workers", value=8,   min_value=1, max_value=16)
                qt_skip_dl = st.checkbox("Skip download (use existing data)", value=data_exists)

            qt_demo = st.checkbox(
                "Use synthetic demo data (offline / no iNaturalist access)",
                value=False,
                help=(
                    "Generates synthetic colour-pattern images for each species. "
                    "The model will classify these synthetic images well but will NOT "
                    "generalise to real insect photos. "
                    "Use this to test the full pipeline without internet access. "
                    "For real-world performance, leave unchecked and allow iNaturalist download."
                ),
            )

            qt_submit = st.form_submit_button("⚡  Quick Train", type="primary")

        if qt_demo:
            st.info(
                "**Demo mode:** Synthetic images give the classifier something to learn "
                "and prove the end-to-end pipeline works, but the resulting model will "
                "not identify real insect photos accurately.  \n"
                "For real identification, clear the `data/images/` folder and retrain "
                "without demo mode once iNaturalist API access is available.",
                icon="ℹ️",
            )

        if qt_submit:
            cmd = [sys.executable, "train_lite.py",
                   "--images", str(int(qt_images)),
                   "--epochs", str(int(qt_epochs)),
                   "--batch-size", str(int(qt_bs)),
                   "--lr", str(qt_lr),
                   "--workers", str(int(qt_workers))]
            if qt_demo:
                cmd.append("--demo")
            elif qt_skip_dl:
                cmd.append("--no-download")
            load_classifier.clear()
            run_script(cmd, cwd=LOCAL_DIR,
                       spinner_text="Quick training… (download + feature extraction + training)")
            st.rerun()

    with qt_col2:
        st.markdown("**Quick Train vs Full Training**")
        st.markdown(
            "| | Quick Train | Full Train |\n"
            "|---|---|---|\n"
            "| Model | MobileNetV3-S | EfficientNetV2-S |\n"
            "| Backbone | Frozen | Fine-tuned |\n"
            "| Images | 40/class | 150/class |\n"
            "| Time | ~15–30 min | ~45 min (M2) |\n"
            "| Top-1 acc | ~60–75% | ~75–90% |\n"
            "| GPU needed | No | Recommended |\n"
        )

        history_lite = LOCAL_CKPT_DIR / "history_lite.json"
        if history_lite.exists():
            h = json.loads(history_lite.read_text())
            if h:
                df_h = pd.DataFrame(h)
                st.markdown("**Lite training curve**")
                st.line_chart(
                    df_h.set_index("epoch")[["train_acc", "top1_acc", "top3_acc"]],
                    use_container_width=True, height=160,
                )
                best = df_h.loc[df_h["top1_acc"].idxmax()]
                c1, c2 = st.columns(2)
                c1.metric("Best val top-1", f"{best['top1_acc']:.1%}")
                c2.metric("Best val top-3", f"{best['top3_acc']:.1%}")

        if ckpt_lite:
            st.success(f"✅ Lite checkpoint present ({file_size_str(LOCAL_CKPT_DIR / 'best_model_lite.pth')})")

    st.divider()
    st.markdown("### Full Training Pipeline")
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
                        "Common Name":    m["common_name"],
                        "Scientific Name": m["scientific_name"],
                        "Taxon ID":       m["taxon_id"],
                        "Images":         _img_count(m["taxon_id"]),
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
                    spinner_text="Downloading dataset… (15–30 min)",
                )
                st.rerun()

    # ── Step 2: Train ─────────────────────────────────────────────────────────
    with st.expander("### Step 2 · Train Full Model", expanded=data_exists and not ckpt_full):
        left, right = st.columns([3, 2])

        with left:
            st.markdown(
                "Two-phase EfficientNetV2-S fine-tune:  \n"
                "• **Phase 1** — head-only warm-up (frozen backbone)  \n"
                "• **Phase 2** — full fine-tune with cosine LR decay  \n\n"
                "Runtime: ~**30–40 min** on M2 Mac, ~**2–4 h** on CPU."
            )

            if not data_exists:
                st.warning("⚠️  Dataset not found — complete Step 1 first.")

            with st.form("train_config_form"):
                st.markdown("**Hyperparameters**")
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
                    "PYTORCH_ENABLE_MPS_FALLBACK (macOS)",
                    value=sys.platform == "darwin",
                )
                submitted = st.form_submit_button(
                    "🚀  Start Training", type="primary", disabled=not data_exists,
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
                load_classifier.clear()
                run_script(
                    [sys.executable, "02_train.py"],
                    cwd=LOCAL_DIR, env=env_patch,
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
                        use_container_width=True, height=220,
                    )
                    best = df_h.loc[df_h["top1_acc"].idxmax()]
                    c1, c2 = st.columns(2)
                    c1.metric("Best epoch",  int(best["epoch"]))
                    c2.metric("Top-1 acc",   f"{best['top1_acc']:.1%}")
                    c1.metric("Top-3 acc",   f"{best['top3_acc']:.1%}")
                    c2.metric("Train acc",   f"{best['train_acc']:.1%}")
            else:
                st.info("Training history will appear here once Step 2 completes.")

            if ckpt_full:
                st.success(f"✅ Checkpoint  ({file_size_str(LOCAL_CKPT_DIR / 'best_model.pth')})")

    # ── Step 3: Inference test ─────────────────────────────────────────────────
    with st.expander("### Step 3 · Test Inference", expanded=False):
        if not ckpt_exists:
            st.warning("⚠️  No checkpoint found — complete Step 1 (Quick Train) or Step 2 first.")
        else:
            left, right = st.columns(2)

            with left:
                st.markdown("**Upload an insect photo or use a dataset sample**")
                uploaded = st.file_uploader(
                    "Insect photo", type=["jpg", "jpeg", "png", "webp"], key="v_upload",
                )
                top_k_v   = st.slider("Top-K predictions", 1, 5, 3, key="v_topk")
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
                    if uploaded:
                        pil_img = Image.open(uploaded).convert("RGB")
                        with st.spinner("Running inference…"):
                            preds_v = predict_image(pil_img, top_k=top_k_v)
                        st.session_state["v_last_preds"] = preds_v
                    else:
                        # fall back to subprocess for --demo mode
                        script = "03_inference_test.py" if ckpt_full else "train_lite.py"
                        if ckpt_full:
                            cmd_v = [sys.executable, "03_inference_test.py",
                                     "--demo", "--top", str(top_k_v)]
                            rc, output = run_script(
                                cmd_v, cwd=LOCAL_DIR, spinner_text="Running inference…"
                            )
                            preds_v = []
                            for line in output.splitlines():
                                m = re.match(r"\s+#(\d+)\s+([\d.]+)%\s+[█\s]*\s+(.+)", line)
                                if m:
                                    preds_v.append({
                                        "label":      m.group(3).strip(),
                                        "confidence": float(m.group(2)) / 100,
                                        "species_info": None,
                                    })
                            st.session_state["v_last_preds"] = preds_v

                preds_v = st.session_state.get("v_last_preds", [])
                if preds_v:
                    for p in preds_v:
                        st.progress(
                            p["confidence"],
                            text=f"**{p['label']}**  —  {p['confidence']*100:.1f}%",
                        )
                else:
                    st.info("Run identification to see predictions here.")

    # ── Step 4: Export ────────────────────────────────────────────────────────
    with st.expander("### Step 4 · Export for Mobile", expanded=False):
        st.markdown(
            "Converts the best full checkpoint to `.onnx` (Android) and "
            "`.mlpackage` (iOS).  \n"
            "After exporting, copy to `assets/models/` and flip "
            "`USE_NATIVE_VISION = true` in `src/ai/index.ts`."
        )

        if not ckpt_full:
            st.warning("⚠️  No full checkpoint — complete Step 2 first.")
        else:
            c_files, c_actions = st.columns([2, 1])

            with c_files:
                st.markdown("**Export targets**")
                for path, label in [
                    (LOCAL_EXPO_DIR / "insect_classifier.onnx",     "ONNX — Android"),
                    (LOCAL_EXPO_DIR / "insect_classifier.mlpackage", "CoreML — iOS"),
                    (LOCAL_CKPT_DIR / "class_map.json",              "class_map.json"),
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
                        cwd=LOCAL_DIR, spinner_text="Exporting to ONNX + CoreML…",
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
# TAB 4 · PERSONA TRAINING
# ════════════════════════════════════════════════════════════════════════════════

with tab_persona:
    st.header("Persona LoRA Training")
    st.markdown(
        "Per-persona LoRA adapters on top of **Llama-3.2-1B-Instruct**.  \n"
        "Five steps: **Seed → Curate → Train → Test → Export**."
    )
    st.info(
        "💡 Only start this pipeline after the system-prompt approach shows "
        "noticeable drift in real user testing — see `docs/ml-roadmap.md` "
        "§ Track 2 for the decision criteria.",
        icon="💡",
    )

    with st.expander("### Step 1 · Generate Seed Examples", expanded=True):
        st.markdown(
            "Bootstraps ~80 dialogue examples per persona using the Anthropic API.  \n"
            "Reads system prompts directly from `src/personas/index.ts`.  \n"
            "Estimated cost: **~$1–3** with claude-haiku-4-5."
        )

        c_key, c_opts = st.columns(2)
        with c_key:
            api_key = st.text_input(
                "ANTHROPIC_API_KEY", type="password", placeholder="sk-ant-…",
                value=os.environ.get("ANTHROPIC_API_KEY", ""),
                help="Used only locally. Never stored.",
            )
        with c_opts:
            seed_model = st.selectbox(
                "Model",
                options=["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
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

    with st.expander("### Step 2 · Curate Examples", expanded=False):
        st.markdown(
            "Review each AI-generated example. Accept, edit, or reject.  \n"
            "**Target: 300 curated examples per persona.**"
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
            st.progress(min(len(curated_rows) / 300, 1.0),
                        text=f"{len(curated_rows)} / 300  ({len(curated_rows)/300*100:.0f}%)")

        if not seed_rows:
            st.info("No seed examples yet — run Step 1 first.")
        else:
            idx_key = f"curate_idx_{curate_persona}"
            if idx_key not in st.session_state:
                st.session_state[idx_key] = 0

            idx     = max(0, min(int(st.session_state[idx_key]), len(seed_rows) - 1))
            current = seed_rows[idx]

            st.divider()
            c_prog, c_nav = st.columns([3, 1])
            with c_prog:
                st.progress((idx + 1) / len(seed_rows),
                            text=f"Example {idx + 1} of {len(seed_rows)}")
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
                        "input": "",
                        "output": edited_output,
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
                if st.button("⏭️  Skip", key=f"skip_{curate_persona}_{idx}",
                             use_container_width=True):
                    st.session_state[idx_key] = min(idx + 1, len(seed_rows) - 1)
                    st.rerun()

            if curated_rows:
                with st.expander(f"Browse saved examples ({len(curated_rows)})"):
                    df_cur = pd.DataFrame(curated_rows)
                    if "instruction" in df_cur.columns:
                        st.dataframe(
                            df_cur[["instruction", "output"]].rename(
                                columns={"instruction": "Question", "output": "Response"}
                            ),
                            use_container_width=True, hide_index=True, height=300,
                        )
                    csv_bytes = df_cur.to_csv(index=False).encode()
                    st.download_button(
                        "⬇️ Export as CSV", data=csv_bytes,
                        file_name=f"{curate_persona}_curated.csv", mime="text/csv",
                    )

    with st.expander("### Step 3 · Train LoRA Adapters", expanded=False):
        st.markdown(
            "Trains one 15 MB LoRA adapter per persona on top of Llama-3.2-1B-Instruct.  \n"
            "Best on Kaggle T4 GPU. Works on M-series Mac (slower)."
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
            c_cfg1, c_cfg2 = st.columns(2)
            with c_cfg1:
                lora_r      = st.number_input("Rank (r)",       value=8,   min_value=2,   max_value=64)
                lora_alpha  = st.number_input("Alpha",          value=16,  min_value=4,   max_value=256)
                lora_epochs = st.number_input("Epochs",         value=3,   min_value=1,   max_value=20)
            with c_cfg2:
                lora_lr = st.number_input("Learning rate", value=2e-4, format="%.0e",
                                          min_value=1e-5, max_value=1e-2)
                lora_bs = st.number_input("Batch size",    value=4,   min_value=1,   max_value=64)

            mps_lora = st.checkbox("PYTORCH_ENABLE_MPS_FALLBACK (macOS)",
                                   value=sys.platform == "darwin")
            eligible = [p for p, c in curated_counts.items() if c >= 30]
            train_personas = st.multiselect(
                "Personas to train (need ≥ 30 curated)", options=eligible, default=eligible,
            )
            start_lora = st.form_submit_button(
                "🚀  Start LoRA Training", type="primary",
                disabled=not eligible or not train_personas,
            )

        if not eligible:
            st.warning("⚠️  No persona has ≥ 30 curated examples.")

        if start_lora and train_personas:
            env_lora: dict[str, str] = {}
            if mps_lora:
                env_lora["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
            run_script(
                [sys.executable, "03_train_lora.py"],
                cwd=PERSONAS_DIR, env=env_lora,
                spinner_text="Training LoRA adapters…",
            )
            st.rerun()

    with st.expander("### Step 4 · Test Persona Inference", expanded=False):
        st.markdown("Side-by-side: base model vs base + LoRA adapter.")
        c_inp, c_out = st.columns(2)
        with c_inp:
            test_persona = st.selectbox("Persona", PERSONA_NAMES, key="p_test_sel")
            test_prompt  = st.text_area(
                "Question",
                value="What's the difference between a moth and a butterfly?",
                height=100, key="p_test_prompt",
            )
            run_p_test = st.button("🔬  Run Comparison", key="btn_p_test", type="primary")
        with c_out:
            if run_p_test:
                run_script(
                    [sys.executable, "04_inference_test.py",
                     "--persona", test_persona, "--prompt", test_prompt],
                    cwd=PERSONAS_DIR, spinner_text="Running comparison…",
                )

    with st.expander("### Step 5 · Export GGUF Adapters", expanded=False):
        st.markdown("Converts LoRA → GGUF for `llama.rn`. ~15 MB per adapter.")

        c_files, c_btn = st.columns([2, 1])
        ckpts_any = False

        with c_files:
            for persona in PERSONA_NAMES:
                ckpt_ok = (PERSONAS_CKPT_DIR / persona).exists()
                gguf_ok = (PERSONAS_EXPO_DIR / f"{persona}.gguf").exists()
                if ckpt_ok:
                    ckpts_any = True
                st.markdown(
                    f"{tick(ckpt_ok)} Checkpoint: `checkpoints/{persona}/`  \n"
                    f"{tick(gguf_ok)} GGUF: `exported/{persona}.gguf`"
                )

        with c_btn:
            if not ckpts_any:
                st.warning("⚠️  No checkpoints — complete Step 3 first.")
            else:
                if st.button("📦  Export Adapters", type="primary", key="btn_export_p",
                             use_container_width=True):
                    run_script(
                        [sys.executable, "05_export_adapters.py"],
                        cwd=PERSONAS_DIR, spinner_text="Exporting GGUF adapters…",
                    )
                    st.rerun()

                all_ggufs = all(
                    (PERSONAS_EXPO_DIR / f"{p}.gguf").exists() for p in PERSONA_NAMES
                )
                if all_ggufs:
                    if st.button("📋  Copy to assets/models/", key="btn_copy_p",
                                 use_container_width=True):
                        MODELS_DIR.mkdir(parents=True, exist_ok=True)
                        for persona in PERSONA_NAMES:
                            src = PERSONAS_EXPO_DIR / f"{persona}.gguf"
                            if src.exists():
                                shutil.copy2(src, MODELS_DIR / f"{persona}.gguf")
                        st.success("✅ All adapters copied!")
                        st.rerun()


# ════════════════════════════════════════════════════════════════════════════════
# TAB 5 · MODEL STATUS
# ════════════════════════════════════════════════════════════════════════════════

with tab_status:
    st.header("Model Status & Files")

    c_hdr, c_refresh = st.columns([5, 1])
    with c_refresh:
        if st.button("🔄 Refresh", key="btn_refresh_status", use_container_width=True):
            st.rerun()

    st.subheader(f"📁 `{MODELS_DIR.relative_to(ROOT_DIR)}/`")

    expected_models = [
        ("insect_classifier.onnx",             "Android vision classifier",               False),
        ("insect_classifier.mlpackage",         "iOS vision classifier",                   False),
        ("class_map.json",                      "Label → species mapping (full model)",    False),
        ("llama-3.2-1b-instruct-q4_k_m.gguf",  "Base LLM — download separately (~800 MB)", True),
        ("larva.gguf",                          "Larva persona adapter (~15 MB)",          False),
        ("snail.gguf",                          "Snail persona adapter (~15 MB)",          False),
        ("maywind.gguf",                        "Maywind persona adapter (~15 MB)",        False),
    ]

    asset_rows = []
    for fname, desc, manual in expected_models:
        path   = MODELS_DIR / fname
        exists = path.exists()
        size   = file_size_str(path) if exists else "—"
        status = "✅ Present" if exists else ("⚠️ Download manually" if manual else "❌ Missing")
        asset_rows.append({"File": fname, "Description": desc, "Status": status, "Size": size})

    st.dataframe(pd.DataFrame(asset_rows), use_container_width=True, hide_index=True)

    with st.expander("How to get the base LLM weights"):
        st.markdown("""
```bash
pip install huggingface_hub
huggingface-cli download bartowski/Llama-3.2-1B-Instruct-GGUF \\
    Llama-3.2-1B-Instruct-Q4_K_M.gguf \\
    --local-dir assets/models/ --local-dir-use-symlinks False

mv assets/models/Llama-3.2-1B-Instruct-Q4_K_M.gguf \\
   assets/models/llama-3.2-1b-instruct-q4_k_m.gguf
```""")

    st.subheader("🦋 Vision Training Artifacts")

    v_artifacts = [
        LOCAL_DATA_DIR,
        LOCAL_META_DIR / "species_manifest.json",
        LOCAL_CKPT_DIR / "best_model_lite.pth",
        LOCAL_CKPT_DIR / "class_map_lite.json",
        LOCAL_CKPT_DIR / "history_lite.json",
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
            "Path":   str(path.relative_to(ROOT_DIR)),
            "Status": tick(exists),
            "Size":   file_size_str(path) if exists else "—",
        })
    st.dataframe(pd.DataFrame(v_rows), use_container_width=True, hide_index=True)

    # Show training curves side by side
    h_lite_path = LOCAL_CKPT_DIR / "history_lite.json"
    h_full_path = LOCAL_CKPT_DIR / "history.json"
    if h_lite_path.exists() or h_full_path.exists():
        cols = st.columns(2)
        for col, path, title in [
            (cols[0], h_lite_path, "Lite model (MobileNetV3)"),
            (cols[1], h_full_path, "Full model (EfficientNetV2)"),
        ]:
            if path.exists():
                h = json.loads(path.read_text())
                if h:
                    df_h = pd.DataFrame(h)
                    with col:
                        st.markdown(f"**{title}**")
                        st.line_chart(
                            df_h.set_index("epoch")[["train_acc", "top1_acc", "top3_acc"]],
                            use_container_width=True, height=180,
                        )
                        best = df_h.loc[df_h["top1_acc"].idxmax()]
                        c1, c2 = st.columns(2)
                        c1.metric("Top-1 acc", f"{best['top1_acc']:.1%}")
                        c2.metric("Top-3 acc", f"{best['top3_acc']:.1%}")

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

    st.subheader("⚙️ Environment")

    c_sys1, c_sys2 = st.columns(2)

    with c_sys1:
        st.markdown(f"**Python** `{sys.version.split()[0]}`  \n**Platform** `{sys.platform}`")
        if TORCH_AVAILABLE:
            if torch.backends.mps.is_available():
                accel = "✅ Apple MPS (M-series GPU)"
            elif torch.cuda.is_available():
                accel = f"✅ CUDA — {torch.cuda.get_device_name(0)}"
            else:
                accel = "⚠️ CPU only"
            st.markdown(f"**PyTorch** ✅ `{torch.__version__}`  \n**Accelerator** {accel}")
        else:
            st.markdown("**PyTorch** ❌ not installed")

        if INSECT_DATA_AVAILABLE:
            st.markdown(f"**Insect data** ✅ {len(SPECIES_DATA)} species loaded")
        else:
            st.markdown("**Insect data** ❌ insect_data.py not found")

    with c_sys2:
        for pkg, label in [
            ("timm",          "timm (EfficientNetV2)"),
            ("torchvision",   "torchvision (MobileNetV3)"),
            ("transformers",  "Transformers"),
            ("peft",          "PEFT (LoRA)"),
            ("anthropic",     "Anthropic SDK"),
            ("onnxruntime",   "ONNX Runtime"),
        ]:
            try:
                mod = __import__(pkg)
                ver = getattr(mod, "__version__", "installed")
                st.markdown(f"✅ **{label}** `{ver}`")
            except ImportError:
                st.markdown(f"❌ **{label}** — not installed")

    with st.expander("Install dependencies"):
        st.markdown("**Vision classifier (full pipeline):**")
        st.code("pip install -r training/local/requirements.txt", language="bash")
        st.markdown("**Dashboard + lite training:**")
        st.code("pip install -r tools/training-ui/requirements.txt", language="bash")
        st.markdown("**Persona training:**")
        st.code("pip install -r training/personas/requirements.txt", language="bash")
