#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Critterboard training cleanup
#
# Removes the virtualenv, downloaded datasets, training artifacts, and
# (opt-in) the global HuggingFace / PyTorch caches that were created while
# running the training dashboard.
#
# Files copied to assets/models/ are NOT touched — those are deliverables,
# not training infrastructure. Delete them manually if you want a full wipe.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

VENV_DIR="$ROOT_DIR/.venv"
VISION_DATA="$ROOT_DIR/training/local/data"
VISION_CKPT="$ROOT_DIR/training/local/checkpoints"
VISION_EXPO="$ROOT_DIR/training/local/exported"
PERSONA_DATA="$ROOT_DIR/training/personas/data"
PERSONA_CKPT="$ROOT_DIR/training/personas/checkpoints"
PERSONA_EXPO="$ROOT_DIR/training/personas/exported"
HF_CACHE="${HF_HOME:-$HOME/.cache/huggingface}"
TORCH_CACHE="${TORCH_HOME:-$HOME/.cache/torch}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

Remove files created by the Critterboard training dashboard.

Scopes (pick one or more):
  --venv         Project virtualenv at .venv/ (removes ALL pip packages)
  --data         Downloaded datasets + seed/curated examples
  --artifacts    Training checkpoints + exported models (.onnx/.mlpackage/.gguf)
  --hf-cache     Global HuggingFace model cache ($HF_CACHE)
  --torch-cache  Global PyTorch hub cache       ($TORCH_CACHE)
  --all          --venv + --data + --artifacts (keeps global caches)
  --nuke         --all + --hf-cache + --torch-cache (wipe everything)

Modifiers:
  -y, --yes      Skip the confirmation prompt
  -n, --dry-run  Print what would be removed, delete nothing
  -h, --help     Show this help

Examples:
  $(basename "$0") --venv                 # just remove the virtualenv
  $(basename "$0") --all --dry-run        # preview a full project wipe
  $(basename "$0") --nuke -y              # nuke everything, no prompts
EOF
}

RM_VENV=0
RM_DATA=0
RM_ARTIFACTS=0
RM_HF=0
RM_TORCH=0
ASSUME_YES=0
DRY_RUN=0

if [[ $# -eq 0 ]]; then
    usage
    exit 0
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --venv)        RM_VENV=1 ;;
        --data)        RM_DATA=1 ;;
        --artifacts)   RM_ARTIFACTS=1 ;;
        --hf-cache)    RM_HF=1 ;;
        --torch-cache) RM_TORCH=1 ;;
        --all)         RM_VENV=1; RM_DATA=1; RM_ARTIFACTS=1 ;;
        --nuke)        RM_VENV=1; RM_DATA=1; RM_ARTIFACTS=1; RM_HF=1; RM_TORCH=1 ;;
        -y|--yes)      ASSUME_YES=1 ;;
        -n|--dry-run)  DRY_RUN=1 ;;
        -h|--help)     usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; echo ""; usage; exit 1 ;;
    esac
    shift
done

TARGETS=()
[[ $RM_VENV      -eq 1 ]] && TARGETS+=("$VENV_DIR")
[[ $RM_DATA      -eq 1 ]] && TARGETS+=("$VISION_DATA" "$PERSONA_DATA")
[[ $RM_ARTIFACTS -eq 1 ]] && TARGETS+=("$VISION_CKPT" "$VISION_EXPO" "$PERSONA_CKPT" "$PERSONA_EXPO")
[[ $RM_HF        -eq 1 ]] && TARGETS+=("$HF_CACHE")
[[ $RM_TORCH     -eq 1 ]] && TARGETS+=("$TORCH_CACHE")

if [[ ${#TARGETS[@]} -eq 0 ]]; then
    echo "Nothing to do. Pass one of --venv, --data, --artifacts, --all, --nuke." >&2
    exit 1
fi

size_of() {
    local p="$1"
    if [[ -e "$p" ]]; then
        du -sh "$p" 2>/dev/null | awk '{print $1}'
    else
        echo "—"
    fi
}

echo ""
echo "Targets:"
echo ""
printf "  %-8s  %s\n" "SIZE" "PATH"
printf "  %-8s  %s\n" "----" "----"
for t in "${TARGETS[@]}"; do
    if [[ -e "$t" ]]; then
        printf "  %-8s  %s\n" "$(size_of "$t")" "$t"
    else
        printf "  %-8s  %s  (not present)\n" "—" "$t"
    fi
done
echo ""

if [[ $DRY_RUN -eq 1 ]]; then
    echo "[dry-run] No files were deleted."
    exit 0
fi

if [[ $ASSUME_YES -ne 1 ]]; then
    read -r -p "Proceed with deletion? [y/N] " reply
    case "$reply" in
        y|Y|yes|YES) ;;
        *) echo "Aborted."; exit 1 ;;
    esac
fi

for t in "${TARGETS[@]}"; do
    if [[ -e "$t" ]]; then
        echo "→ removing $t"
        rm -rf -- "$t"
    else
        echo "  (skip, not present) $t"
    fi
done

echo ""
echo "✓ Cleanup complete."
