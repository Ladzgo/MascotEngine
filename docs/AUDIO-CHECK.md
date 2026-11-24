# Audio check: ep001-inflation (real ElevenLabs voice, cached)

Run: `scripts/audio-check.sh [episode-dir]` (ffmpeg ebur128, no API calls). No music track in assets/music, so this covers voice + SFX only.

## Measured
| File | Integrated | LRA | True peak |
|---|---|---|---|
| mix.wav (final) | -14.5 LUFS | 7.9 LU | -1.5 dBTP |
| voice.wav | -16.1 LUFS | 8.1 LU | -1.0 dBTP |
| sfx.wav | -22.0 LUFS | 9.4 LU | -4.2 dBTP |

- Mix loudness: PASS (target -14 +/-1; -0.5 LU low, loudnorm single-pass undershoots).
- True peak: PASS (-1.5, under -1.0 ceiling).
- Voice vs SFX (RMS of non-silent parts): voice -16.6 dBFS, SFX -23.1 dBFS, gap 6.4 dB.
  Gap is under the 8 dB target, so SFX can partly mask the voice where a hit overlaps speech. Verdict: problem, mild.
- Not measured: ducking/pumping (no music track yet); re-run after T2 adds music.

## Recommended changes to src/pipeline/audio.ts
1. SFX gain: lower per-event gain (`c.kind === 'tick' ? 0.5 : 0.8`) to `0.3 : 0.5` (about -4 dB). Target gap voice - sfx >= 8 dB, ideally 9-10.
2. Add loudness trim on voice before summing, or keep voice unchanged and only lower SFX (preferred; voice peak -1.0 dBFS is already hot).
3. Duck SFX under speech too: sidechain SFX from voice, e.g. `[1:a][0:a]sidechaincompress=threshold=0.03:ratio=4:attack=5:release=200[sfxd]`, then mix `[0:a][sfxd]`.
4. Use two-pass loudnorm (measure, then `measured_I/measured_TP/measured_LRA/measured_thresh/offset`) with `I=-14:TP=-1.5:LRA=11:linear=true` to land on -14.0 instead of -14.5.
5. Add a final `alimiter=limit=0.84` (about -1.5 dBFS) after loudnorm as a safety ceiling.
6. When music lands (T2): keep bed at about -22 dB before ducking; require >= 8 dB reduction during speech; add `afade` in 1 s and out 2 s.
7. Optional: place a 0.3 s voice-free gap before a big_number SFX hit so the sting never overlaps the number being spoken.
