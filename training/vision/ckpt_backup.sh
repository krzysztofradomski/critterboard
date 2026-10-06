#!/usr/bin/env bash
# While training runs: every few hours push the latest last.pth to the single-commit
# branch retrain-household-ckpt. last.pth (~265 MB) is over GitHub's 100 MB file limit,
# so it goes up in 90 MB parts plus a SHA-256. Each push replaces the previous one
# (amend + force), so old copies don't pile up in the repo.
#
#   restore: cat last.pth.part-* > last.pth && sha256sum -c last.pth.sha256
#            (macOS: shasum -a 256 -c last.pth.sha256), then put it in the run's
#            --out folder and re-run the same command.
#
# Env: RUN (training output dir), MARK (stage-marker dir: stops after 7_train),
#      EVERY (seconds, default 10800), CKPT_REPO (scratch git dir, default $RUN/.ckpt-push).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RUN="${RUN:?}"
MARK="${MARK:?}"
EVERY="${EVERY:-10800}"
REPO="${CKPT_REPO:-$RUN/.ckpt-push}"
BRANCH=retrain-household-ckpt
URL=$(git -C "$HERE" remote get-url origin)

if [ ! -d "$REPO/.git" ]; then
  git init -q "$REPO"
  git -C "$REPO" remote add origin "$URL"
  git -C "$REPO" checkout -q --orphan "$BRANCH"
  git -C "$REPO" config user.name "$(git -C "$HERE" config user.name)"
  git -C "$REPO" config user.email "$(git -C "$HERE" config user.email)"
fi

checksum() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

push_once() {
  [ -f "$RUN/last.pth" ] || return 0
  [ -f "$REPO/.stamp" ] && [ ! "$RUN/last.pth" -nt "$REPO/.stamp" ] && return 0
  touch "$REPO/.stamp.new"
  # cp reads one inode; train.py swaps last.pth in with os.replace, so this copy is never torn.
  cp "$RUN/last.pth" "$REPO/last.pth" || return 1
  rm -f "$REPO"/last.pth.part-*
  (cd "$REPO" && split -b 90m last.pth last.pth.part- && checksum last.pth > last.pth.sha256 && rm last.pth)
  cp "$RUN/history.json" "$REPO/" 2>/dev/null
  printf '%s\n' "Resumable training checkpoint for the household retrain (branch retrain-household-v2)." \
    "Not for merging. Restore: cat last.pth.part-* > last.pth, check last.pth.sha256," \
    "put it in the run's --out folder and re-run the same command. Saved $(date -u +%FT%TZ)." > "$REPO/README.md"
  (
    cd "$REPO" || exit 1
    git add -A
    if git rev-parse -q --verify HEAD >/dev/null; then
      git commit -q --amend -m "last.pth backup (household retrain)"
    else
      git commit -q -m "last.pth backup (household retrain)"
    fi
    for i in 1 2 3 4; do
      git push -q -f origin "$BRANCH" && exit 0
      sleep $((2 ** i))
    done
    exit 1
  )
  local ok=$?
  git -C "$REPO" reflog expire --expire=now --all && git -C "$REPO" gc -q --prune=now
  if [ $ok -eq 0 ]; then mv "$REPO/.stamp.new" "$REPO/.stamp"; echo "backup pushed $(date -u +%FT%TZ)"; fi
  return $ok
}

while [ ! -f "$MARK/7_train" ]; do
  sleep "$EVERY"
  push_once || echo "backup push failed $(date -u +%FT%TZ)"
done
push_once
