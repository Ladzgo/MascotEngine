#!/usr/bin/env bash
# Installs the offline bundle on the Linux machine (run it from the extracted bundle directory).
# Usage: ./setup-linux.sh [DEST]       default DEST=$HOME/ytAutomation, user-level installs under $HOME/.local (no root needed
# except for the optional apt step, which runs only as root or with sudo). Re-running is safe.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
DEST=${1:-$HOME/ytAutomation}
PREFIX=${PREFIX:-$HOME/.local}
say() { printf '\n== %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "0. verify checksums"
[ -f "$HERE/MANIFEST.sha256" ] && (cd "$HERE" && sha256sum -c --quiet MANIFEST.sha256) && echo "all files match" || echo "no manifest or mismatch (see above)"

say "1. system packages (apt/*.deb)"
if ls "$HERE"/apt/*.deb >/dev/null 2>&1; then
  if [ "$(id -u)" = 0 ]; then dpkg -i "$HERE"/apt/*.deb || true
  elif have sudo; then sudo dpkg -i "$HERE"/apt/*.deb || true
  else echo "Not root and no sudo: install apt/*.deb as root (dpkg -i apt/*.deb), then re-run."; fi
else echo "apt/ is empty: install ffmpeg espeak-ng cmake build-essential and the Chromium libraries from apt-packages.txt yourself."; fi

say "2. repository -> $DEST"
mkdir -p "$DEST"; cp -a "$HERE"/repo/. "$DEST"/
cd "$DEST"

say "3. npm packages from the bundled cache (offline)"
npm ci --offline --no-audit --no-fund --cache "$HERE/npm-cache"

say "4. Remotion Chromium"
if [ -f "$HERE/chromium/chrome-headless-shell-linux64.zip" ]; then
  REMV=$(cat "$HERE/chromium/REMOTION_VERSION" 2>/dev/null || echo "$(cat "$HERE/chromium/VERSION")-remotion-v3")
  D=node_modules/.remotion/chrome-headless-shell/$REMV/linux64
  mkdir -p "$D"; unzip -oq "$HERE/chromium/chrome-headless-shell-linux64.zip" -d "$D"
  cp "$HERE/chromium/REMOTION_VERSION" "node_modules/.remotion/chrome-headless-shell/$REMV/VERSION" 2>/dev/null || true
  chmod +x "$D"/chrome-headless-shell-linux64/chrome-headless-shell
  echo "installed $D"
fi

say "5. whisper.cpp (build) + model"
mkdir -p data/models "$PREFIX/bin"
[ -f "$HERE/whisper/ggml-base.en.bin" ] && cp "$HERE/whisper/ggml-base.en.bin" data/models/
if ls "$HERE"/whisper/whisper.cpp-*.tar.gz >/dev/null 2>&1; then
  if have cmake && have g++; then
    W=$(mktemp -d); tar -xzf "$HERE"/whisper/whisper.cpp-*.tar.gz -C "$W"; (cd "$W"/whisper.cpp-* && cmake -B build -DCMAKE_BUILD_TYPE=Release >/dev/null && cmake --build build -j"$(nproc)" --config Release --target whisper-cli)
    cp "$W"/whisper.cpp-*/build/bin/whisper-cli "$PREFIX/bin/"; rm -rf "$W"; echo "whisper-cli -> $PREFIX/bin"
  else echo "cmake/g++ missing: install them (apt-packages.txt) and re-run, or build whisper.cpp by hand (see OFFLINE.md)."; fi
fi

say "6. Ollama + model"
if ls "$HERE"/ollama/ollama-linux-*.tar.* >/dev/null 2>&1; then
  F=$(ls "$HERE"/ollama/ollama-linux-*.tar.* | head -1); mkdir -p "$PREFIX"
  case "$F" in *.zst) have zstd && zstd -dc "$F" | tar -x -C "$PREFIX" || echo "zstd missing: install it, re-run";; *) tar -xzf "$F" -C "$PREFIX";; esac
fi
if [ -d "$HERE/ollama/models" ]; then mkdir -p "$HOME/.ollama/models"; cp -a "$HERE/ollama/models/." "$HOME/.ollama/models/"; echo "models -> ~/.ollama/models"; fi

say "7. piper voice"
if ls "$HERE"/piper/piper_linux_*.tar.gz >/dev/null 2>&1; then
  mkdir -p "$PREFIX/piper"; tar -xzf "$HERE"/piper/piper_linux_*.tar.gz -C "$PREFIX"; cp "$HERE"/piper/*.onnx "$HERE"/piper/*.onnx.json "$PREFIX/piper/" 2>/dev/null || true
  ONNX=$(ls "$PREFIX"/piper/*.onnx 2>/dev/null | head -1 || true)
  touch .env
  grep -q '^PIPER_BIN=' .env || echo "PIPER_BIN=$PREFIX/piper/piper" >> .env
  [ -n "$ONNX" ] && { grep -q '^PIPER_MODEL=' .env || echo "PIPER_MODEL=$ONNX" >> .env; }
fi

say "8. PATH"
case ":$PATH:" in *":$PREFIX/bin:"*) ;; *) echo "Add to ~/.bashrc:  export PATH=\"$PREFIX/bin:$PREFIX/piper:\$PATH\"";; esac
export PATH="$PREFIX/bin:$PREFIX/piper:$PATH"

say "9. doctor"
npm run doctor || { echo; echo "Doctor lists what is still missing. Fix those, then run: npm run doctor"; exit 1; }
