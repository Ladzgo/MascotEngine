# Roadmap (planning agent, 2026-11)

## Status 2026-11-24 (supersedes the task list below where they differ)
Done: drafter (Ollama, HU), clipper, Shorts, Studio (Library, Pipeline, Queue, Calendar, Analytics, Clipper, onboarding wizard, ZIP export/import, palette actions, HU/EN UI incl. all pages), render cache, QA + golden frames, CI, `npm run smoke:ui`, loading skeletons + error boundary per page. See CHANGELOG.md and docs/DECISIONS.md.
Open:
- Library theme filter: needs `series` (or a topic field) in the episode summary in studio/server.ts, then a filter in Library.tsx.
- CSS items in docs/UI_FINDINGS.md (skeletons, Pipeline board and stepper at phone width, density, contrast).
- Real mascot art (T7), real YouTube analytics exports to validate the importer, a larger HU model (gemma3:12b) for publishable Hungarian scripts.
- Zod per-route validation in studio/server.ts (in progress elsewhere).
- Draft quality: stuttery runs of short talk scenes, ungrounded chart numbers (see DECISIONS item 54).

State: M1-M5 done; ElevenLabs TTS, ffmpeg-letterbox Shorts and Studio UI done.
Lanes: **A** = src/ (pipeline, director, scenes, character, schema). **B** = studio/ (server + web UI) and DESIGN.md.
**C** = docs/, assets/, scripts/, data/ (content, no app logic). Lane files never overlap; a task needing another lane's file waits on a stated contract.
Shared-file rule: `package.json` and `src/schema.ts` belong to A only. B and C ask A for script entries / schema fields.

## 1. Ranked tasks (impact on video quality + "few clicks")

**T1. Real audio proof: ElevenLabs voice + music ducking test.** (L: C, size S, deps none)
- Why: ducking and loudness were never heard with a real voice; bad audio is the fastest way to look amateur.
- Check: ep002 final plays with voice clear over music, -14 LUFS +/-1 (`ffmpeg -af ebur128`), no pumping; notes in DECISIONS.md.
- Files: `docs/AUDIO_QA.md` (new), `assets/music/*`, `assets/LICENSES.md`. Tuning edits to `src/pipeline/audio.ts` go to T2.

**T2. Music + audio polish.** (A, M, deps T1 findings)
- Why: assets/music is empty; the mix has one fixed bed. Pick track by director mood, duck threshold/release tuned, fade in/out, per-scene music swell at big_number.
- Check: `npm test` audio test covers track selection by mood; two episodes pick different beds; ducking depth >= 8 dB during speech measured by ffmpeg.
- Files: `src/pipeline/audio.ts`, `src/pipeline/audio.test.ts`, `src/director/direct.ts` (music field only).

**T3. Script drafter (M7): `npm run draft -- "topic"` via Claude API.** (A, L, deps T4 for VOICE.md; schema stays unchanged)
- Why: removes the biggest manual step; "pick topic -> click Generate" needs a script to exist.
- Check: output passes `Episode.parse`; hook in first scene under ~15 words; every `big_number`/`chart` value traces to a URL in `sources`; no guarantee/advice language (post-lint rule list); `--dry` prints the prompt; unit test with a mocked client.
- Files: `src/draft/draft.ts`, `src/draft/cli.ts`, `src/draft/lint.ts`, `src/draft/draft.test.ts`, `package.json` (script `draft`, `@anthropic-ai/sdk`). Does NOT touch `src/pipeline/cli.ts`.

**T4. docs/VOICE.md + series bible + disclaimer text.** (C, S, deps none)
- Why: the drafter and the human editor both need one tone spec (casual, dry humour, no hype, no returns promises) with good/bad examples drawn from ep001/ep002.
- Check: contains banned-phrase list, hook patterns, scene-type guidance, source rules, a 6-8 minute pacing budget (words per scene type); T3 loads it verbatim as system prompt.
- Files: `docs/VOICE.md`, `docs/CHANNEL.md` (new, naming/mascot placeholders).

**T5. Studio "New from topic" + one-click auto (Generate everything).** (B, M, deps T3 CLI contract: `npm run draft -- "<topic>" --id <id>` exits 0 and writes episodes/<id>/episode.json)
- Why: the single biggest "few clicks" gain: topic text box -> draft -> review -> auto pipeline.
- Check: empty state shows topic field; job log streams drafter output; failure shows message plus retry; stub the CLI until T3 lands (button disabled with "Drafter not installed" when `ANTHROPIC_API_KEY` missing).
- Files: `studio/server.ts` (new `draft` stage + `ANTHROPIC_API_KEY` in settings), `studio/web/src/App.tsx`, `studio/web/src/Settings.tsx`, `studio/web/src/api.ts`, `studio/web/src/StageTrack.tsx`.

**T6. Native 9:16 Shorts composition.** (A, L, deps none)
- Why: letterboxed 16:9 is small on a phone and screams repurposed; native vertical (big captions, one idea, mascot bottom-third) is what Shorts channels use.
- Check: `npm run shorts -- ep002` gives 1080x1920 files, no clipped text (frame extracts at 3 timestamps), captions >= 64 px, loop-friendly last frame; hook line (scene 1 narration) is the first 2 s.
- Files: `src/Root.tsx` (new `Short` composition), new `src/ShortEpisode.tsx`, `src/pipeline/shorts.ts`, `src/scenes/captions.tsx` (size prop only).

**T7. Real mascot art + `assets:check` run.** (C then A, M, deps human art)
- Why: placeholder mascot is the clearest "template" tell. Run `npm run assets:check`, fix reports, drop PNGs.
- Check: assets:check exits 0 (sizes, alpha, baseline, all 12 emotions + `_talk`); ep001 frame extracts show real art with no code change.
- Files: C: `assets/character/*`, `docs/ART_BRIEF.md` (Appendix A prompts, pose list per emotion). A (only if check finds bugs): `src/pipeline/assetsCheck.ts`, `src/character/Mascot.tsx`.

**T8. Local voice: recording import + whisper alignment.** (A, M, deps none; server hook is T9)
- Why: stub blocks the "own voice" path; also gives accurate word timings for captions.
- Check: `npm run tts -- ep --engine local` aligns `episodes/<id>/audio/scene-N.wav` with `whisper.cpp` word timestamps; timings.json schema identical to ElevenLabs; clear error if the binary or model is missing.
- Files: `src/pipeline/tts.ts`, `src/pipeline/tts.test.ts`, new `src/pipeline/whisper.ts`.

**T9. Studio polish: assets/audio readiness panel and "stop at preview" toggle.** (B, S, deps T7/T8 for full value)
- Why: PRODUCT.md expects a per-run stop-at-preview option; a readiness card (ffmpeg, key set, art present, music present) removes silent failures.
- Check: toggle changes stage list; panel lists missing items with the fix; engine `local` selectable once T8 lands.
- Files: `studio/server.ts` (`/api/readiness`), `studio/web/src/Settings.tsx`, `studio/web/src/App.tsx`, `studio/web/src/styles.css`.

**T10. Topic/trend scout (M8) + analytics feedback loop.** (A scout, C data, L, deps T3, real published videos)
- Why: shortens ideation; later closes the loop on which treatments hold retention. Do only after 5+ videos are public.
- Check: `npm run scout` returns 5 ranked topics with source links (RSS/FRED/BLS, no scraping), dedup against `data/history.json` titles; analytics import reads YouTube CSV and writes `data/retention.json` that the director may read as a mild score weight.
- Files: `src/scout/*`, `src/director/direct.ts` (retention weight only, after T2 merges), `data/retention.json`.

## 2. Parallelism
Right now, no shared files: **T1+T4 (C)**, **T3 (A, needs T4 only at integration)**, **T6 (A, different files from T3)**, **T8 (A)**, **T5 (B, against the CLI contract)**. Because T3, T6, T8 are all lane A, run at most two A agents at once, and give T2 `audio.ts` only after T1.
Sequence: T1,T4 -> T3,T6 -> T5,T2 -> T7,T8,T9 -> T10. T7 is gated by human art, so start the art brief first.

## 3. Top risks
1. **Policy (YouTube "inauthentic/mass-produced content", finance claims).** Identical structure and synthetic voice at volume can be demonetised. Mitigation: human edits every script (Studio keeps a required "reviewed" flag before final; B), original angle plus sourced numbers per episode, disclaimer end-card on, cap at 2-3 uploads/week, disclose AI voice in the description, no investment advice phrasing (T3 lint).
2. **Quality (looks like a template or sounds flat).** Placeholder mascot, no music, 6 scene types. Mitigation: T7 and T1/T2 before scaling output; judge each episode by frame extracts plus listening test; add scene types only when the content needs them (e.g. `timeline`, `quote`) via A.
3. **Cost (ElevenLabs characters, Claude tokens, render time).** A 8 min script is about 8k characters per TTS run, and auto-regeneration multiplies it. Mitigation: Studio re-voices only changed scenes (cache by hash of narration in `audio/`; A, in T8), preview uses silent engine by default, show the estimated cost before running, drafter uses a mid-tier model with a single revision pass.

## 4. Less template-like ideas using real content signals (one per area)
- **Hook:** the drafter extracts the single most surprising number from `sources` and the director forces the opening scene to `big_number` or `compare` with that number, 3-second cold open before the title card. Hook form (question / shock number / myth statement) rotates by history.
- **Pacing:** use word timestamps. Scene tail and punch-ins follow sentence length and punctuation (short sentence plus number -> hold 0.6 s; long explanation -> slower camera drift); no scene runs over ~12 s without a visual change (extra `emphasis` word callouts).
- **Visuals:** `emphasis` words trigger hand-drawn doodle props (coins, houses, arrows) chosen by keyword map in `assets/props`; charts annotate the real inflection point (max, crossover year) computed from the data, not a fixed callout.
- **Sound:** pick the music mood from scene emotion arc (worried -> minor, smug -> light), swell on big_number landings, and put a 0.3 s silence before the key number; SFX variant seeded from the number's magnitude, never the same sting twice in a row.
