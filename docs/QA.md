# Episode QA (`npm run qa -- <id> [--file video.mp4]`)

Runs on `episodes/<id>/build/<id>-final.mp4` (else `-preview.mp4`), needs `decisions.json` + `timings.json`. Writes `build/qa.json`, prints PASS/FAIL per check, exit 0 = all pass, 1 = failing checks, 2 = error. Free, local (ffmpeg only). Thresholds live in `LIMITS` in `scripts/qa/qa.ts`.

| Check | Threshold | Why |
|---|---|---|
| render is current | video mtime >= decisions/timings | a stale render makes every other result meaningless |
| duration | 45 s .. 20 min | below 45 s it is a Short, above 20 min the pipeline was not built for it |
| audio stream | present | |
| loudness (ffmpeg loudnorm, integrated) | -16 .. -12.5 LUFS | mix target -14; YouTube normalises down, not up |
| true peak | <= -1.0 dBTP | codec headroom |
| loudness range | <= 14 LU | no jumps between music and voice |
| longest pause (voice.wav, silencedetect -38 dB, 0.35 s, leading/trailing ignored) | <= 1.5 s | pacing rule from Item 27/31 (avg gap ~0.4 s) |
| pause share | <= 25% of duration | |
| caption coverage | >= 90% of speech seconds inside a phrase window | data check against `buildPhrases` |
| frames at 10/30/50/70/90% (centred on the nearest spoken word) | not blank (std dev >= 4), side margin strips (2% each) edge density <= 12%, caption zone (y 86-99%) edge density >= 2% | catches empty scenes, content cut by the frame edge, missing captions |

Known limit: the frame checks are heuristics (gradient density), not OCR; a transition wipe sampled mid-frame can trip the margin check, re-run or look at the frame. Silent (`--engine silent`) episodes have no speech, so pause and caption checks are not meaningful.

## E2E smoke test (`npm run e2e -- ["topic"] [--keep] [--strict] [--engine auto]`)

`scripts/e2e.ts` runs a fresh topic through draft, voice, direct, preview render, QA and subtitle export (via the same stage runner as `npm run batch`) and exits 1 if a stage fails, an output (`-preview.mp4`, `.srt`, `.vtt`, `qa.json`) is missing or empty. QA findings are printed as warnings; `--strict` makes them fail the run. The temporary episode is deleted on success (`--keep` keeps it, a failed run is always kept for inspection). It needs the local LLM (Ollama) and takes about 2 minutes on the 8-core Mac (draft 65 s, voice 14 s, preview 29 s).

## Golden frames (`npm run qa:golden`)
One 480x270 still per scene type (title, talk, talk with quote, big_number, chart, compare, list, timeline, before_after) from a pinned fixture (`scripts/qa/golden/episode.json`, silent voice, pinned accent/background), compared by SSIM with `scripts/qa/golden/*.jpg` (threshold 0.985; an accent change scores 0.93 to 0.98, an identical render 1.0000). Exit 1 and `FAIL-*.jpg` (git-ignored) on a visible change. After an intended visual change run `npm run qa:golden -- --update` and commit the new references (about 160 KB in total). Not part of `npm test` (about 40 s, needs Chromium).
