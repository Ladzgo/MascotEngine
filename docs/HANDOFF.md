# Handoff: Mascot Engine + Studio (read this first)

Project: automated, non-template educational finance YouTube videos (hand-drawn mascot "Penny"), plus "Mascot Engine Studio", a local web app that runs the whole pipeline in a few clicks. Owner talks Hungarian; code, comments, file names and on-screen video text stay English. Read in this order: PRODUCT.md, DESIGN.md, docs/ROADMAP.md, docs/DECISIONS.md (items 1-20), CLAUDE_CODE_PROMPT.md (original brief), README.md.

## How to run
- `npm install`, then `npm run app` -> http://localhost:4177 (Studio). No keys are required: local Ollama (auto-started, `qwen2.5:7b` preferred) writes scripts/ideas/publish packs, macOS `say` is the default voice, whisper.cpp (if installed with `data/models/ggml-base.en.bin`) aligns words. Optional keys in `.env`: ELEVENLABS_API_KEY/ELEVENLABS_VOICE_ID, or `LLM_PROVIDER=anthropic|gemini` + key. Never print or commit keys. One-click: Today > Make video (draft > voice > direct > preview). Extra CLIs: `npm run thumbnail -- <id>`, `npm run scout`. Restart the Studio server after pulling server changes.
- CLI: `npm run tts|direct|render|shorts -- <episode-id>`, `npm run draft -- "<topic>" --id <id> --channel <id>`, `npm run ideas -- --channel <id>`, `npm run publish-pack -- <episode-id>`, `npm run channel -- list`, `npm run assets:check`, `npm run typecheck`, `npm test`.

## Done
- Pipeline M1-M5: schema, director (content-driven, history per channel, pacing + hook), scenes, camera, transitions, captions + .srt, synthesized SFX, audio mix (two-pass loudnorm, limiter, SFX ducked), preview and final renders.
- ElevenLabs TTS (word timestamps, per-scene cache so re-runs cost nothing), local-recording TTS (whisper alignment, NOT installed on this machine, fallback = proportional timing), silent TTS.
- Native 9:16 Shorts (Remotion composition), Penny mascot drawn in code with 20 poses (accent tie, dry/cynical face), PNG override loader, `scripts/export-poses.sh`, `scripts/pad-pose.sh`, `scripts/audio-check.sh`.
- Multi-channel: `channels/<id>/channel.json`, per-channel history and voice, ideas generator, publish pack (chapters/description offline, titles via Claude with offline fallback), script drafter with lint.
- Studio: episode list, storyboard editor, inspector with director overrides, player (stale-render flag), stage track with live progress/cancel/retry, settings, own-voice upload per scene (generated audio protected), draft box, readiness checks. Server API hardened (QA done, 400/404/409/413/416 paths).

## Just finished (verify quickly)
- Studio multi-channel UI is built: channel switcher, Overview landing page, Channels page, Ideas board, Publish tab (server: channel CRUD, /api/overview, ideas, publish-pack, 501 when a CLI is missing). Not browser-clicked: the Publish tab and the real Ideas flow (no Anthropic credits). `episodes/ep001-inflation/build/publish.json` was deleted by a test: regenerate with `npm run publish-pack -- ep001-inflation`.
- First thing to do in a new session: `npm run typecheck`, `npm test`, open the Studio and click through Overview, Channels, Ideas, an episode and its Publish tab.

## Known gaps / next steps (ranked)
1. Re-render ep001 and ep002 with Penny (the last renders still show the old placeholder) and review frames.
2. Anthropic account has no credits: ideas, draft, AI titles are untested against the real API (mock-tested only).
3. No music yet: assets/music is empty; the user must supply licensed tracks; then test ducking and pick tracks by mood (record licences in assets/LICENSES.md).
4. Whisper is not installed: install whisper.cpp (needs WHISPER_MODEL) if the user wants own-voice alignment.
5. Hook-in-first-2-seconds and loop-friendly last frame checks for Shorts.
6. ElevenLabs cost estimate per run in Studio; topic/trend scout and analytics loop (ROADMAP T10, only after 5+ public videos).
7. Placement polish at 150px legibility check for Penny; counting_money coins are small.
8. Policy: every script gets a human review before final; sources + disclaimer + synthetic-voice disclosure (docs/PUBLISHING-CHECKLIST.md).

## Working rules (from the owner's CLAUDE.md)
- Talk to the owner in Hungarian, short and direct, no filler. Show only the changed snippet/diff, not whole files. After a big task remind them to `/compact` or `/clear`.
- Shell via the Bash tool as plain commands (an rtk hook rewrites them). For search use `rtk grep`, `rtk find`, `rtk ls`, never the Grep/Glob tools; read big files with `rtk read`. Do not bypass the hook. Subagents follow the same rules.
- Multi-agent work is welcome: split by lane with no shared files. Lane A = src/ (pipeline, director, scenes, character; one agent owns package.json), lane B = studio/ + DESIGN.md, lane C = docs/assets/scripts. Never call paid APIs (ElevenLabs/Anthropic) in tests; use mocks or cached audio.
- Design work follows DESIGN.md (ink on paper, accent via --accent, min 12px, no gradients/glass). Impeccable skill is installed (`/impeccable`).
- Append to docs/DECISIONS.md with a single append command and keep numbering unique (check the last number first).
