# Smart long-form clipper

`npm run clip -- <video> [--min 20 --max 60 --count 5] [--words words.json] [--out dir] [--no-render]`

Free and local: ffmpeg, whisper.cpp (`whisper-cli` + `data/models/ggml-base.en.bin`, same detection as `src/pipeline/align.ts`) and Remotion's Chromium (captions). `--words` skips whisper (JSON array of `{w,start,end}`).

Pipeline (`src/clipper/`)
1. `segment.ts`: word timestamps -> sentences (terminal punctuation or pause >= 0.7 s) -> every run of whole sentences within min..max -> scored -> best non-overlapping `count`. Clips start on a sentence start, end on a sentence end with terminal punctuation, padded 0.15-0.3 s (capped at half the gap to the neighbouring word). Score: hook (question, hook word, number, short first sentence), density, numbers/questions/emotion words, closed ending; dangling opener ("and/but/so...") and long internal pauses are penalised.
2. `crop.ts`: ffmpeg samples 4 fps 96 px gray frames; the motion-weighted horizontal centroid is the subject track (holds last position when there is no motion). `smooth.ts` `smoothPath`: median (spikes) -> zero-lag EMA -> deadband + max-speed follower (0.35 crop-widths/s), clamped to the frame. Knots every 0.5 s become a nesting-free ffmpeg `x=` expression.
3. `render.ts`: 9:16 1080x1920 crop+scale, 3-word caption chunks with the active word highlighted (transparent ProRes 4444 video rendered by Remotion (`src/ClipCaptions.tsx`, `captions.ts`; no ImageMagick/libass/drawtext, works on Linux offline; yellow active word, white stroke-less text with black outline + shadow, 940 px safe width, band bottom 340 px above the frame end; `--no-captions` skips, a failed render warns and the clip goes out without), audio `highpass=80` + two-pass `loudnorm` to -14 LUFS (TP -1.5).
4. Output `out/clips/<name>/timeline.json` (zod `TimelineSchema`, `timeline.ts`) + `clipN.mp4`. Word times are absolute source seconds; `crop.path` is `{t from clip start, x left edge px}`.

Limits: motion centroid, not face detection (a static speaker with a moving background can pull the crop; ONNX/OpenCV not wired). English whisper model. `CLIP_FONT` overrides the caption font.
Tests: `npx tsx --test src/clipper/*.test.ts` (synthetic transcript, synthetic frames, schema).
