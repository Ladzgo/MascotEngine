# Voice engines (docs/VOICE.md is the script-writing guide; this file is about the spoken voice)

Setup: `npm run setup:voice` (uv + Python 3.12 venv `.venv-tts`, about 700 MB of models in `data/models/tts`; `VOICE_SMALL=1` skips Kokoro and the English Piper voice). `npm run doctor` shows the state and the fix command.

| Engine | Where | Languages | Notes |
|---|---|---|---|
| `kokoro` | local, Apache-2.0, Kokoro-82M (326 MB + 28 MB voices) | English | Most natural offline English. Default voice `af_heart`; try `am_michael`, `bf_emma` via `TTS_VOICE_KOKORO`. |
| `piper` | local, MIT | Hungarian (anna, berta, imre medium), English (ryan high) | Best offline Hungarian. Voice via `TTS_VOICE_PIPER=hu_HU-imre-medium`. |
| `edge` | online, keyless Microsoft neural voices | en (Ava Multilingual, Brian), hu (Noemi, Tamas), de, es | Sends the script text to Microsoft. Never chosen by `auto` unless `TTS_ONLINE=1`; select it explicitly in Studio > Settings. Voice via `TTS_VOICE_EDGE`. |
| `say` | macOS built-in | many | Robotic. Last fallback. |

`auto` order: English kokoro, piper; other languages piper; then `say`.

Pipeline per scene: numbers, currency, percent, years and abbreviations become words (`src/pipeline/speech.ts`, English and Hungarian numerals) -> narration cut into clauses with a speed of 0.93-1.05 per clause (stressed phrases slower, questions lift) and pauses by punctuation (period 280 ms, question 340, comma 120, dash 220, +-60 ms jitter) -> engine -> 70 Hz high-pass, faint short room reflection, edge trim -> whisper alignment against the written narration -> mix (de-ess, compression, room tone, music ducking, two-pass -14 LUFS). SSML is not used: none of the three engines honours it reliably (edge-tts drops it), prosody comes from clause rate and pauses.

A/B: `npm run voice-test -- --text "..." --lang en|hu` writes `out/voice-test/<engine>.wav` (loudness-matched to about -14 LUFS), prints duration and LUFS and opens the files.

Recommendation (by design, not yet by ear: audition with voice-test): English channels Kokoro `af_heart`; Hungarian channels Piper `hu_HU-anna-medium` offline, or edge `hu-HU-NoemiNeural` when sending the text to Microsoft is acceptable (it is the most natural Hungarian here).
