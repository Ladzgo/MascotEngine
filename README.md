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
npm run thumbnail -- ep003-topic --variants 2   # A/B thumbnails + 150 px readability check
npm run publish-pack -- ep003-topic         # titles, description, tags, chapters, upload notes (offline fallback without AI)
npm run subs -- ep003-topic                 # .srt, word-level .vtt, chapters.txt
npm run qa -- ep003-topic                   # loudness, pauses, captions, frame checks (docs/QA.md)
npm run batch -- --topics topics.txt        # many episodes unattended (or --scout 5); writes batch-report.json
npm run clip -- video.mp4                   # long video -> 9:16 clips (docs/CLIPPER.md)
npm run analytics -- import studio.csv      # YouTube Studio CSV -> data/retention.json; `-- summary`
npm run doctor                              # what is missing on this machine, with fixes
npm run bundle                              # offline package for the Linux machine (docs/OFFLINE.md)
npm run e2e                                 # smoke test: topic -> preview -> qa -> subs
npm run channel -- create my-tech --preset tech   # presets: finance, tech, history
npm run studio                              # Remotion Studio (frame-level preview)
npm run assets:check                        # validate assets/character art
npm run typecheck
npm test
```

Guides: `docs/GUIDE.md` (Hungarian user guide), `docs/OFFLINE.md` (offline Linux install), `docs/QA.md`, `docs/CLIPPER.md`, `docs/SECURITY.md`.

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

## Linux install (offline work machine)
Prepare everything on a machine with internet, then copy it over (the repo is on GitHub: `git clone https://github.com/Ladzgo/MascotEngine`).
1. Node 20+ and `npm ci` (copy `node_modules` too if the target has no registry access). Remotion needs a Chromium: run `npx remotion browser ensure` online once and copy `node_modules/.remotion` (or install `chromium`).
2. `apt install ffmpeg espeak-ng` (download the `.deb` files and their dependencies beforehand: `apt-get install --download-only`).
3. Ollama: install the Linux binary, then `ollama pull qwen2.5:7b` online and copy `~/.ollama/models` to the same path on the target.
4. whisper.cpp: build `whisper-cli`, put it on `PATH`, and copy `ggml-base.en.bin` to `data/models/` (or set `WHISPER_MODEL`). Optional but gives word-accurate captions.
5. Better voice (optional): piper binary + an `.onnx` voice, then `PIPER_BIN` and `PIPER_MODEL` in `.env`. Without it espeak-ng is used.
6. Music: drop licensed tracks into `assets/music/` (an ambient pad is included).
7. Check: `npm run app`, then `GET /api/readiness` (Studio server) lists every missing piece with its fix. Over SSH use `ssh -L 4177:localhost:4177 host` and open http://localhost:4177.

## Upgrading old episodes (J-cut, mood music)
Old `episodes/<id>/build/decisions.json` files predate the J-cut/L-cut offsets (negative `speechStart`), the mood music bed (`music.track`) and the SFX variant memory. They still render, but without those. To refresh one without redrafting: `npm run direct -- <id>` (then `npm run render -- <id>`). Regenerate the voice (`npm run tts -- <id>`) as well if it was made before the silence trimming. Old episodes do not need to be redone.
