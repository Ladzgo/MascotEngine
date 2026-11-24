# Smart long-form clipper

`npm run clip -- <video> [--min 20 --max 60 --count 5] [--words words.json] [--out dir] [--no-render]`

Free and local: ffmpeg, whisper.cpp (`whisper-cli` + `data/models/ggml-base.en.bin`, same detection as `src/pipeline/align.ts`) and Remotion's Chromium (captions). `--words` skips whisper (JSON array of `{w,start,end}`).

Pipeline (`src/clipper/`)
1. `segment.ts` + `snap.ts`: word timestamps -> sentences (terminal punctuation or pause >= 0.7 s) -> every run of whole sentences within min..max -> scored -> best non-overlapping `count`. Clips start on a sentence start, end on a sentence end with terminal punctuation, padded 0.15-0.3 s (capped at half the gap to the neighbouring word). Score: hook (question, hook word, number, short first sentence), density, numbers/questions/emotion words, closed ending; dangling opener ("and/but/so...") and long internal pauses are penalised.
   whisper-cli word times are contiguous across sentences (gap 0), so `snap.ts` moves every cut onto real silence (10 ms RMS of the audio, quiet = <12% of speech level, cut 70% into the pause, max 0.25 s air; unchanged if no pause is found). Measured on a 84 s say() test: all cuts land in silence (tail RMS 0.0001).
2. `crop.ts`: ffmpeg samples 4 fps 96 px rgb frames; the motion-weighted horizontal centroid is the subject track, with background suppression (columns that move in >60% of frames, e.g. ticker/screen/flashing light, are down-weighted to 2%; frames whose motion is mostly suppressed hold the last position) and a skin-tone boost (non-skin motion x0.35). Holds last position when there is no motion. `smooth.ts` `smoothPath`: median (spikes) -> zero-lag EMA -> deadband + max-speed follower (0.35 crop-widths/s), clamped to the frame. Knots every 0.5 s become a nesting-free ffmpeg `x=` expression.
3. `render.ts`: 9:16 1080x1920 crop+scale, 3-word caption chunks with the active word highlighted (transparent ProRes 4444 video rendered by Remotion (`src/ClipCaptions.tsx`, `captions.ts`; no ImageMagick/libass/drawtext, works on Linux offline; yellow active word, white stroke-less text with black outline + shadow, 940 px safe width, band bottom 340 px above the frame end; `--no-captions` skips, a failed render warns and the clip goes out without), audio `highpass=80` + two-pass `loudnorm` to -14 LUFS (TP -1.5).
4. Output `out/clips/<name>/timeline.json` (zod `TimelineSchema`, `timeline.ts`) + `clipN.mp4`. Word times are absolute source seconds; `crop.path` is `{t from clip start, x left edge px}`.

Limits: motion centroid, not face detection (a static speaker with a moving background can pull the crop; ONNX/OpenCV not wired). English whisper model. `CLIP_FONT` overrides the caption font.
Tests: `npx tsx --test src/clipper/*.test.ts` (synthetic transcript, synthetic frames, schema).

## Clipper -> Studio integration (plan; UI is built by the studio thread)

Already in `studio/server.ts`: `GET /api/clips` (job state, `data/uploads` list, finished items), `GET /api/clips/<name>/<file>.mp4`, `POST /api/clips/upload?name=` (raw body), `POST /api/clip {upload|path, min, max, count}` (runs `npm run clip`, one job at a time, 409 when busy).

Gaps and the endpoints that would close them (all JSON, local, no key):
1. `GET /api/clip/<name>` returns the full `timeline.json` (words, crop path, score reasons) so the UI can show the transcript with the cut handles and the crop track. Source video is served by `GET /api/clips/<name>/source` (proxy of `timeline.source`, range requests).
2. `POST /api/clip/<name>/<id>/render {start?, end?, cropX?, captions?}` re-renders one clip after the user nudged the cut (snapped to silence again server-side), pinned the crop (`cropX` = constant left edge px, replaces the tracked path) or toggled captions. CLI needs `--only clipN --start --end --crop-x`; `renderClip(file, clip, out, caps)` already takes a finished Clip, so this is a thin wrapper. Returns 202 and reuses the same job/log channel.
3. `GET /api/clip/events` (SSE, like `/api/queue/events`) with `{stage: 'transcribe'|'segment'|'crop'|'captions'|'render', clip?, pct}`. CLI prints one `CLIP_STAGE <stage> <i>/<n>` line per step, server forwards them; needed because whisper on a long video takes minutes.
4. `POST /api/clip/cancel` kills the child process (queue integration: submit through `POST /api/queue` like other jobs so Make video and clipping do not fight over CPU).
5. `DELETE /api/clip/<name>` (+ `/<id>`) moves the run to `episodes/_trash`-style `out/clips/_trash`.
6. `POST /api/clip/<name>/<id>/publish-pack` reuses `src/publish` (titles from the clip text, description with the AI-voice note only when the audio is synthetic; a human-voiced clip must not claim it).
7. `GET /api/clip/readiness` fields (add to `/api/readiness`): whisper-cli, ggml model, ffmpeg, Chromium for captions (`ensureBrowser`).

UI expectations: upload -> Clip (min/max/count) -> grid of 9:16 previews with score reasons; click opens transcript with draggable start/end handles (snap hint shown), crop track as a line over the source frame, captions toggle; export = download mp4 + publish pack. Timeline JSON is the single source of truth; the UI never edits mp4s.

Other CLI facts for the UI thread: `npm run shorts -- <id>` now prints a real-frame check (first frame, 1.5 s hook, 15/50/90%, loop delta); `npm run thumbnail -- <id> --variants 2` writes `build/thumbnail.png` + `thumbnail-b.png` and prints a 150 px readability line; `build/publish.json` has `uploadNotes` (YouTube Studio steps incl. the altered/synthetic content question) next to titles/description/tags/chapters.

## Benchmark: 3 voices, moving background (`npx tsx scripts/clipper-bench.ts`)

macOS `say` voices Samantha, Daniel, Karen (en_US/en_GB/en_AU), six turns of 25-27 s with 0.6 s silence between turns, 1280x720 video: dimmed `testsrc2` as busy moving background (counters, bars, gradients everywhere) plus a skin-coloured bobbing box that jumps to the active speaker's position (x = 250 / 640 / 1030). Ground truth = who speaks when. Whisper `ggml-base.en`.

| Measure | Result |
|---|---|
| clips found / ending on terminal punctuation | 3 / 3 (each one whole speaker turn, 27.5 s) |
| cut end inside real silence (RMS < 12% of speech level) | 3 / 3 |
| cut start inside silence | 3 / 3 |
| crop centre error vs. speaker centre (px, crop width 404, excluding 3 s after a speaker change) | before: 373 (background pulled the track to the centre), 204 (skin boost only), 122 (skin-only motion), **46** (densest skin blob only) |
| mean jerk (second difference, px/s^2) | 21 |
| max speed | 142 px/s (limit 0.35 x 404 = 141) |
| direction reversals | 1 in 3 clips |

What changed because of the benchmark (`crop.ts`): (1) when everything moves (busy scene) no column stands out, so the background filter is switched off instead of muting the whole frame; (2) if a person-like skin blob is in frame, only motion of the densest skin cluster (best 20-column window) counts, motion elsewhere (screens, skin-coloured clutter) is ignored, and a motionless person holds the track; (3) frames with no skin at all (cartoons, slides) fall back to the old rule (non-skin motion x0.35, background-column filter). Limits: the person finder is colour based (dark skin tones under strange lighting, a beige wall that moves, two people talking at once pick the denser blob); no face detection (ONNX not wired).

## Languages (multilingual whisper)

`--lang auto|hu|en|de|...` on `npm run clip`. Model: `WHISPER_MODEL=data/models/ggml-base.bin` (multilingual; `ggml-small.bin` is better for Hungarian but ~470 MB; download from huggingface.co/ggerganov/whisper.cpp). Rules (`src/clipper/lang.ts`): an English-only `.en.bin` model forces `en` and a different `--lang` is an error with the fix; a multilingual model defaults to `auto` (whisper.cpp itself defaults to `en`, which garbles other languages). Tested with macOS `say -v Tünde` (hu_HU) and `ggml-base.bin`: "Miért maradt szegény a legtöbb ember? Senki nem mondja el az igazat a pénzről." recognised correctly with and without `--lang hu`, cut at the sentence end. Captions use the Archivo Black latin-ext subset (`assets/fonts/archivo-black-latin-ext-400-normal.woff2`) so ő/ű render; the highlight skips common Hungarian function words (a, az, és, hogy...). Sentence scoring keywords (hook words, emotion words) are English only: for other languages the clip choice rests on sentence boundaries, density, numbers and questions. `data/models/` is git-ignored, so the model is not in the repo (the offline bundle takes `WHISPER_MODEL` models only if copied into `data/models/ggml-base.en.bin` by name; add the multilingual file by hand).

## Branding: watermark and end-screen CTA (per channel)

`channels/<id>/channel.json`:
```json
"branding": {"handle": "@MoneyMyths", "cta": "Subscribe for the next myth", "outroSec": 2, "watermark": true}
```
Optional `channels/<id>/watermark.png` (max 300 KB, shown next to the handle). No `branding` key = nothing changes (opt-in; the three presets include a cta line). Shorts (`npm run shorts`) read the episode's channel automatically: the corner mark (below the Shorts header, left of the button column) runs through the whole clip and a CTA card (dim backdrop, spring entrance, accent bar, handle) is appended for `outroSec` seconds, audio padded with silence. Clipper: `npm run clip -- video.mp4 --channel <id>`: watermark and CTA are transparent PNG layers rendered by Remotion (`BrandLayer` composition), ffmpeg overlays them; the CTA extends the clip (last frame held) so it never covers speech. `npm run shorts` sizes the percent frame checks to the content, not the card. Code: `src/Branding.tsx`, `src/channel/branding.ts`.
