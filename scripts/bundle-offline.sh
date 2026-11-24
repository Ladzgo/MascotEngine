#!/usr/bin/env bash
# Builds dist/offline-bundle-<date>.tar.gz on a machine WITH internet, for a Linux machine WITHOUT.
# Usage: scripts/bundle-offline.sh [--dry]      (npm run bundle)
# Env:   TARGET_OS=linux TARGET_CPU=x64  OLLAMA_MODEL=qwen2.5:7b  SKIP="npm chromium whisper ollama piper"  (space list)
#        WHISPER_CPP_VERSION=v1.7.5  PIPER_VOICE=en_US-lessac-medium  OLLAMA_URL=...  (override download URLs if upstream moved them)
# Nothing big is committed: dist/ and the staging dir are in .gitignore. See docs/OFFLINE.md (Hungarian).
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1
TARGET_OS=${TARGET_OS:-linux}; TARGET_CPU=${TARGET_CPU:-x64}
MODEL=${OLLAMA_MODEL:-qwen2.5:7b}
WHISPER_CPP_VERSION=${WHISPER_CPP_VERSION:-v1.7.5}
PIPER_VOICE=${PIPER_VOICE:-en_US-lessac-medium}
PIPER_TAG=${PIPER_TAG:-2023.11.14-2}
OLLAMA_URL=${OLLAMA_URL:-https://ollama.com/download/ollama-linux-amd64.tar.zst}
SKIP=" ${SKIP:-} "
DATE=$(date +%Y%m%d)
B=dist/offline-bundle-$DATE
skip() { [[ "$SKIP" == *" $1 "* ]]; }
say() { printf '\n== %s\n' "$*"; }
run() { if [ $DRY = 1 ]; then echo "[dry] $*"; else "$@"; fi; }
fetch() { # url dest : resumable, skipped when the file already exists
  [ -s "$2" ] && { echo "have $2"; return; }
  run mkdir -p "$(dirname "$2")"; run curl -fL --retry 3 -C - -o "$2.part" "$1" && { [ $DRY = 1 ] || mv "$2.part" "$2"; }
}

run rm -rf "$B"; run mkdir -p "$B"/{repo,npm-cache,chromium,whisper,ollama,piper,apt}

say "1. repository source (git archive, no node_modules, no episodes/build)"
if [ $DRY = 1 ]; then echo "[dry] git archive HEAD | tar -x -C $B/repo"; else git archive HEAD | tar -x -C "$B/repo"; fi

if ! skip npm; then
  say "2. npm cache for $TARGET_OS/$TARGET_CPU (node_modules has native binaries: esbuild, @remotion/compositor-*, so it is not copied)"
  if [ $DRY = 1 ]; then echo "[dry] npm ci --ignore-scripts --os=$TARGET_OS --cpu=$TARGET_CPU --cache $B/npm-cache (in a temp copy of package.json + lock)"; else
    T=$(mktemp -d); cp package.json package-lock.json "$T"/; CACHE=$PWD/$B/npm-cache
    (cd "$T" && npm_config_os=$TARGET_OS npm_config_cpu=$TARGET_CPU npm_config_libc=${TARGET_LIBC:-glibc} npm ci --ignore-scripts --no-audit --no-fund --cache "$CACHE")
    rm -rf "$T"
  fi
fi

if ! skip chromium; then
  say "3. Remotion headless Chromium (linux64)"
  VER=$(cat node_modules/.remotion/chrome-headless-shell/*/VERSION 2>/dev/null | head -1 | sed 's/-remotion.*//')
  [ -n "$VER" ] || { echo "Run 'npx remotion browser ensure' here first (needed to learn the pinned version), or SKIP=chromium."; exit 1; }
  [ $DRY = 1 ] || { echo "$VER" > "$B/chromium/VERSION"; cp node_modules/.remotion/chrome-headless-shell/*/VERSION "$B/chromium/REMOTION_VERSION"; }
  fetch "https://storage.googleapis.com/chrome-for-testing-public/$VER/linux64/chrome-headless-shell-linux64.zip" "$B/chromium/chrome-headless-shell-linux64.zip"
fi

if ! skip whisper; then
  say "4. whisper.cpp source ($WHISPER_CPP_VERSION, built on the target) + ggml-base.en model"
  fetch "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/$WHISPER_CPP_VERSION.tar.gz" "$B/whisper/whisper.cpp-$WHISPER_CPP_VERSION.tar.gz"
  if [ -s data/models/ggml-base.en.bin ]; then run cp data/models/ggml-base.en.bin "$B/whisper/"; else fetch "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" "$B/whisper/ggml-base.en.bin"; fi
fi

if ! skip ollama; then
  say "5. Ollama Linux binary + only the files of model $MODEL from ~/.ollama/models"
  fetch "$OLLAMA_URL" "$B/ollama/$(basename "$OLLAMA_URL")"
  M=${OLLAMA_MODELS:-$HOME/.ollama/models}
  NAME=${MODEL%%:*}; TAG=${MODEL#*:}; [ "$NAME" = "$MODEL" ] && TAG=latest
  MAN="$M/manifests/registry.ollama.ai/library/$NAME/$TAG"
  [ -f "$MAN" ] || { echo "Model $MODEL not found under $M (run 'ollama pull $MODEL' here first) or SKIP=ollama."; exit 1; }
  if [ $DRY = 1 ]; then echo "[dry] copy manifest + blobs listed in $MAN"; else
    mkdir -p "$B/ollama/models/manifests/registry.ollama.ai/library/$NAME" "$B/ollama/models/blobs"
    cp "$MAN" "$B/ollama/models/manifests/registry.ollama.ai/library/$NAME/$TAG"
    node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1]));for(const d of [m.config,...m.layers])console.log(d.digest.replace(":","-"))' "$MAN" | while read -r f; do cp "$M/blobs/$f" "$B/ollama/models/blobs/$f"; done
  fi
fi

if ! skip piper; then
  say "6. piper binary + voice $PIPER_VOICE"
  fetch "https://github.com/rhasspy/piper/releases/download/$PIPER_TAG/piper_linux_x86_64.tar.gz" "$B/piper/piper_linux_x86_64.tar.gz"
  LANGDIR=${PIPER_VOICE%%-*}; L=${LANGDIR%%_*}; Q=${PIPER_VOICE##*-}; REST=${PIPER_VOICE#*-}; SPK=${REST%-*}
  for ext in onnx onnx.json; do fetch "https://huggingface.co/rhasspy/piper-voices/resolve/main/$L/$LANGDIR/$SPK/$Q/$PIPER_VOICE.$ext" "$B/piper/$PIPER_VOICE.$ext"; done
fi

say "7. setup script, apt list, checksums"
run cp scripts/setup-linux.sh "$B/setup-linux.sh"; run cp docs/OFFLINE.md "$B/OFFLINE.md"
[ $DRY = 1 ] || cat > "$B/apt-packages.txt" <<'APT'
# On a Debian/Ubuntu machine with internet (same release as the target):
#   mkdir debs && cd debs && apt-get download $(apt-cache depends --recurse --no-recommends --no-suggests --no-conflicts --no-breaks --no-replaces --no-enhances $(grep -v '^#' ../apt-packages.txt) | grep '^\w' | sort -u)
# Copy debs/ into the bundle's apt/ directory; setup-linux.sh runs `dpkg -i apt/*.deb` when it has root.
ffmpeg
espeak-ng
cmake
build-essential
libnss3
libdbus-1-3
libatk1.0-0
libatk-bridge2.0-0
libgbm1
libasound2
libxrandr2
libxkbcommon0
libxfixes3
libxcomposite1
libxdamage1
libpango-1.0-0
libcairo2
libcups2
zstd
APT
if [ $DRY = 0 ]; then (cd "$B" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 shasum -a 256 > MANIFEST.sha256); fi

say "8. archive"
run tar -C dist -czf "$B.tar.gz" "$(basename "$B")"
[ $DRY = 1 ] || { du -sh "$B.tar.gz"; echo "Done: $B.tar.gz (copy to the Linux machine, tar xzf, then ./setup-linux.sh)"; }
