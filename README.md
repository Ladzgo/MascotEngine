# Mascot Engine

Local pipeline and web Studio that turn a script (`episode.json`) into a finished English personal-finance explainer video, plus Shorts. A cartoon mascot narrates; the voice is the free macOS `say` engine (ElevenLabs optional); the director picks layouts, camera and SFX from the content; Remotion renders; ffmpeg mixes audio. Runs on your machine, no hosting.

## Requirements
- Node.js 20+ (developed on 26) and npm
- ffmpeg on PATH (audio mix, Shorts)
- Free keyless setup (default): [Ollama](https://ollama.com) for scripts/ideas (the Studio starts it and uses an installed model, preferring `qwen2.5:7b`, else downloads `llama3.1:8b`); macOS `say` for the voice; optional `brew install whisper-cpp` + `data/models/ggml-base.en.bin` (from huggingface.co/ggerganov/whisper.cpp) for exact word timing; music bed `assets/music/ambient-pad.mp3` is generated locally. No account or API key needed. Optional: `LLM_PROVIDER=anthropic|gemini`, ElevenLabs voice.
- ImageMagick (`magick`) only for `scripts/pad-pose.sh` (mascot art prep)

## Setup
```bash
npm install
cp .env.example .env   # then fill the keys below
```
`.env` keys:
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`: real voice (optional; the `silent` engine works without them)
- Voice engines (`--engine`): `auto` (default: `say` on macOS; `piper` if `PIPER_BIN`/`piper` + `PIPER_MODEL=<voice>.onnx`, else `espeak-ng` on Linux; else silent), `say`, `espeak-ng`, `piper`, `eleven`, `local`, `silent`. All keyless engines use whisper-aligned word timing when available.
- No key is needed: scripts/ideas/publish pack use free local Ollama (auto-started, model auto-picked or downloaded), voice defaults to the macOS `say` engine. `LLM_PROVIDER=anthropic|gemini` (+ key) is an optional override.

## Studio (one-click flow)
```bash
npm run app        # http://localhost:4177  (port: STUDIO_PORT)
```
Pick or create an episode, edit the script, press Generate: TTS, direct, preview, final render and Shorts run with live progress. Check the player and variety report, review the script, publish (see `docs/PUBLISHING-CHECKLIST.md`).

## CLI
All episode commands take an episode id (folder under `episodes/`).
```bash
npm run new -- ep003-topic                  # scaffold episodes/ep003-topic/episode.json
npm run draft -- "topic" --id ep003-topic   # draft script via Claude API (see src/draft/cli.ts for flags)
npm run tts -- ep003-topic --engine silent  # or: elevenlabs (default engine is silent)
npm run direct -- ep003-topic [--final]     # director decisions (--final writes history)
npm run render -- ep003-topic [--final]     # preview 720p, or final 1080p
npm run shorts -- ep003-topic --count 3     # Shorts cut-downs
npm run studio                              # Remotion Studio (frame-level preview)
npm run assets:check                        # validate assets/character art
npm run typecheck
npm test
```

## Folder layout
- `src/` pipeline (`pipeline/`), director, drafter (`draft/`), scenes, mascot, schema
- `studio/` local server and React UI
- `episodes/<id>/episode.json` source of truth per episode
- `assets/` `character/` (mascot PNGs), `music/`, `sfx/`, `props/`, `fonts/`, `LICENSES.md`
- `data/history.json` treatment history (only a final render writes it)
- `docs/` voice guide, roadmap, decisions, mascot art guide, publishing checklist
- `scripts/` helper shell scripts (`audio-check.sh`, `pad-pose.sh`)

## Outputs
In `episodes/<id>/build/`: `<id>-preview.mp4`, `<id>-final.mp4`, `<id>.srt`, `timings.json`, `decisions.json`, `variety.md`, `mix.wav`, and `shorts/*.mp4`. TTS audio is in `episodes/<id>/audio/`.

## Mascot art
Until real PNGs exist in `assets/character/` the engine uses a placeholder mascot. See `docs/MASCOT-ART.md`.
