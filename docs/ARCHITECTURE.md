# Architecture

Local, free, offline-capable: a script becomes a narrated, hand-drawn explainer video. TypeScript + Remotion for pictures, ffmpeg for audio and muxing, Ollama/whisper.cpp/`say` for AI, voice and word timing. Hungarian owner, English code and on-screen text per channel `language`.

## Data flow

```
topic / idea ──draft──> episodes/<id>/episode.json          (zod: src/schema.ts, human-edited in Studio)
   episode.json ──tts──> episodes/<id>/audio/scene-N.*       per-scene voice (say | piper | espeak-ng | ElevenLabs | own recordings | silent)
                      └> build/timings.json                  word times per scene (whisper.cpp alignment, else proportional)
   + timings ──direct──> build/decisions.json                 layouts, camera, transitions, poses, accent, punch-ins, SFX, mood bed, frame-aligned scene starts
   decisions + episode + timings ──render──> build/chunks/<mode>/<key>.mp4 (one per scene, cached) ──concat──> video-<mode>.mp4
   decisions + voice ──mix──> build/mix.wav                   voice + SFX (ducked) + mood music bed, two-pass loudnorm -14 LUFS
   video + mix ──mux──> build/<id>-preview.mp4 | <id>-final.mp4, <id>.srt
   final ──shorts──> build/shorts/*.mp4 (9:16, hook first)     publish-pack ──> build/publish.json, subs ──> .vtt/.srt/chapters
```
Separate branch: **Clipper** (`src/clipper`): any long video -> whisper words -> sentence-aligned clip candidates -> motion-centroid 9:16 crop -> `out/clips/<name>/timeline.json` + `clipN.mp4` (docs/CLIPPER.md).

## Modules (src/)
| Module | Job |
|---|---|
| `schema.ts` | zod: Episode/Scene (title, talk(+quote), big_number, chart, compare, list, timeline, before_after) and decisions.json |
| `draft/` | LLM script drafter: prompt (en/hu), repair of small-model JSON, lint, number grounding, critic (stock phrases, payoff), expand/addScenes, `lang.ts` |
| `llm/` | provider choice (Ollama default, Gemini/Anthropic by env), model pick, tolerant JSON |
| `director/` | content-driven visual decisions with variety against `data/history.json`; pacing, hook, J/L-cut, music mood, retention weights |
| `scenes/`, `fx/`, `character/`, `Episode.tsx`, `ShortEpisode.tsx`, `Thumbnail.tsx` | Remotion compositions: scene views, camera, transitions, captions, doodles, overlays, Penny mascot (20 poses) |
| `pipeline/` | tts, align (whisper), render (+`renderCache.ts`), audio mix, shorts, thumbnail, assets check |
| `publish/` | titles/description/tags/chapters (AI with offline fallback), subtitles, schedule CSV |
| `channel/` | `channels/<id>/channel.json` presets (language, voice, accent, branding) |
| `ideas/`, `scout/`, `analytics/` | idea board, Google News topic scout, YouTube retention import and scene-type weights |
| `clipper/`, `batch/`, `doctor/`, `art/` | clipper, multi-episode batch runner, readiness checks (`npm run doctor`), optional scene art |
| `studio/` | `server.ts` (HTTP API, queue, guard in `src/guard.ts`) + `web/` (React: Today, Pipeline, Library, Ideas, Clipper, Analytics, Calendar, Queue, Workspace, Settings) |

## Files on disk
`episodes/<id>/{episode.json,status.json,notes.json,audio/,history/,build/}` · `channels/<id>/channel.json` · `data/history.json` (director variety), `data/retention.json`, `data/models/` (whisper), `data/uploads/` (Clipper uploads) · `assets/{fonts,character,music,props}` · `out/` (clips, schedule.csv) · `.env` (keys, never committed).

## Commands
`npm run app` Studio (localhost:4177) · `draft|ideas|scout` · `tts|direct|render [--final]|shorts [--all]` · `publish-pack|subs|schedule-export|thumbnail` · `clip [--dir]` · `batch` · `qa` (loudness, pauses, frames) · `qa:golden` (scene-type reference frames) · `doctor` · `analytics` · `bundle` (offline kit) · `e2e` · `typecheck` · `test`.

## Invariants worth knowing
- Numbers on screen come only from `episode.json`; a `big_number` the narration does not say becomes a talk scene (`groundNumbers`).
- Everything animated uses scene-local frames and scene lengths are whole frames, so render chunks are position-independent and cached (decisions item 50).
- The Studio binds to 127.0.0.1, checks Host/Origin, and never calls paid APIs unless a key is configured.
- `decisions.json` is the contract between director, renderer and mixer; old files stay valid (optional fields).
