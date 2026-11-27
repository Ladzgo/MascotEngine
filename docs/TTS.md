# Voice engines (docs/VOICE.md is the script-writing guide; this file is about the spoken voice)

Setup: `npm run setup:voice` (uv + Python 3.12 venv `.venv-tts`, about 700 MB of models in `data/models/tts`; `VOICE_SMALL=1` skips Kokoro and the English Piper voice). `npm run doctor` shows the state and the fix command.

| Engine | Where | Languages | Notes |
|---|---|---|---|
| `kokoro` | local, Apache-2.0, Kokoro-82M (326 MB + 28 MB voices) | English | Most natural offline English. Default voice `af_heart`; try `am_michael`, `bf_emma` via `TTS_VOICE_KOKORO`. |
| `piper` | local, MIT | Hungarian (anna, berta, imre medium), English (ryan high) | Best offline Hungarian. Voice via `TTS_VOICE_PIPER=hu_HU-imre-medium`. |
| `edge` | online, keyless Microsoft neural voices | en (Ava Multilingual, Brian), hu (Noemi, Tamas), de, es | Sends the script text to Microsoft. Never chosen by `auto` unless `TTS_ONLINE=1`; select it explicitly in Studio > Settings. Voice via `TTS_VOICE_EDGE`. |
| `chatterbox` | local, MIT (Resemble AI), own torch venv `data/models/chatterbox-venv` + ~6 GB weights in `~/.cache/huggingface` | English | Most expressive in the proxy test; ~4x slower than real time on Apple MPS; outputs carry Resemble's inaudible Perth watermark. Never picked by `auto`; choose it in the Studio or `--engine chatterbox`. |
| `say` | macOS built-in | many | Robotic. Last fallback. |

`auto` order: English kokoro, piper; other languages piper; then `say`.

Pipeline per scene: numbers, currency, percent, years and abbreviations become words (`src/pipeline/speech.ts`, English and Hungarian numerals) -> narration cut into clauses with a speed of 0.83-0.94 per clause (numbers 0.78-0.80; per-voice factor `VOICE_RATE` in neural.ts) (stressed phrases slower, questions lift) and pauses by punctuation (period 280 ms, question 340, comma 120, dash 220, +-60 ms jitter) -> engine -> 70 Hz high-pass, faint short room reflection, edge trim -> whisper alignment against the written narration -> mix (de-ess, compression, room tone, music ducking, two-pass -14 LUFS). SSML is not used: none of the three engines honours it reliably (edge-tts drops it), prosody comes from clause rate and pauses.

A/B: `npm run voice-test -- --text "..." --lang en|hu` writes `out/voice-test/<engine>.wav` (loudness-matched to about -14 LUFS), prints duration and LUFS and opens the files.

Recommendation (by design, not yet by ear: audition with voice-test): English channels Kokoro `af_heart`; Hungarian channels Piper `hu_HU-anna-medium` offline, or edge `hu-HU-NoemiNeural` when sending the text to Microsoft is acceptable (it is the most natural Hungarian here).

## Listening-proxy comparison (2026-11-27)
Same 3 English Short scripts (ep013, ep015, zzb-o1; 104-123 spoken words each), one pass per voice at speed 0.89, no clause pauses. Measured with `.venv-tts` numpy: wpm, pause share and longest pause (runs under -40 dB of peak, >= 150 ms), pitch variability = F0 standard deviation in semitones (autocorrelation tracker, voiced frames). Higher pitch variability = less monotone; the bar is 150-170 wpm and no pause over 0.4 s.

| Voice | wpm | pause share | longest pause | pitch var (st) | note |
|---|---|---|---|---|---|
| chatterbox (MPS) | 174 | 14.1% | 0.52 s | **5.16** | most expressive; real-time factor 4.06 |
| piper en_US-ryan-high | 174 | 2.7% | 0.27 s | 4.52 | almost no breathing gaps: reads as a run-on |
| kokoro am_puck | 175 | 6.6% | 0.80 s | 4.44 | |
| kokoro am_fenrir | 170 | 8.7% | 0.40 s | 4.29 | best kokoro on the bar (pace + pauses) |
| kokoro af_heart (default) | 148 | 16.4% | 0.59 s | 3.69 | calm, needs the pipeline's clause speeds to reach 150-170 |
| kokoro am_michael | 135 | 15.2% | 0.66 s | 3.62 | slow |
| kokoro af_bella | 144 | 17.0% | 0.63 s | 3.47 | |
| kokoro bm_george | 145 | 15.5% | 0.51 s | 3.05 | |
| kokoro bf_emma | 164 | 15.7% | 0.70 s | 2.16 | flattest: avoid |
| kokoro af_nicole | 93 | 34.1% | 1.52 s | 3.84 | whisper style: unusable |

Decision: `af_heart` stays the `auto` default (proven in the pipeline, calibrated pace 164 wpm over speech, fast); `am_fenrir` is the recommended male voice (`TTS_VOICE_KOKORO=am_fenrir`, VOICE_RATE 0.94); `chatterbox` is the opt-in expressive engine when render time allows. These are proxies, not a listening test: audition with `npm run voice-test` before switching a channel.
