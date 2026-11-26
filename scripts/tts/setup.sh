#!/usr/bin/env bash
# One-command voice setup: Python venv (.venv-tts) with kokoro-onnx, piper-tts, edge-tts + model files in data/models/tts.
# Downloads (about 700 MB in total, all free and keyless): Kokoro-82M 326 MB + voices 28 MB, Piper hu_HU anna/berta/imre 63 MB each, en_US ryan-high 121 MB.
# Set VOICE_SMALL=1 to skip Kokoro and the English Piper voice. Needs `uv` (brew install uv).
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v uv >/dev/null || { echo "uv is missing: brew install uv"; exit 1; }
[ -d .venv-tts ] || uv venv --python 3.12 .venv-tts
uv pip install --python .venv-tts/bin/python kokoro-onnx piper-tts edge-tts soundfile
M=data/models/tts; mkdir -p $M
get() { [ -s "$M/$2" ] || { echo "downloading $2"; curl -fL --retry 3 -o "$M/$2.part" "$1" && mv "$M/$2.part" "$M/$2"; }; }
if [ -z "${VOICE_SMALL:-}" ]; then
  K=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
  get $K/kokoro-v1.0.onnx kokoro-v1.0.onnx; get $K/voices-v1.0.bin voices-v1.0.bin
  P=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high
  get $P/en_US-ryan-high.onnx en_US-ryan-high.onnx; get $P/en_US-ryan-high.onnx.json en_US-ryan-high.onnx.json
fi
for v in anna berta imre; do
  P=https://huggingface.co/rhasspy/piper-voices/resolve/main/hu/hu_HU/$v/medium
  get $P/hu_HU-$v-medium.onnx hu_HU-$v-medium.onnx; get $P/hu_HU-$v-medium.onnx.json hu_HU-$v-medium.onnx.json
done
echo "Voice setup done. Compare engines: npm run voice-test -- --text \"...\" --lang en"
