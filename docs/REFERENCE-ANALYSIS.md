# Reference analysis (4 vertical Shorts, 25-62 s, 360x640)

Targets taken from the user's quality references; `npm run qa` checks the measurable ones (speaking pace, visual change rate, loudness, pauses, caption coverage).

| Aspect | Reference | Engine today |
|---|---|---|
| Picture | Full-bleed illustration of exactly what is said (3D/stylised), no mascot, no paper | Paper + mascot + doodles; illustration library (src/visuals) as hero/support art |
| New visual idea | every 2-3 s | every 6-9 s (beats of 12-28 words); QA warns above 6 s average |
| Camera | never static: push, pan, tilt, orbit; match-cuts, 0-4 hard cuts per video | drift/wobble/push-in (src/fx/life.tsx); transitions per director |
| Captions | 2-4 words, centred lower third (y 70-80%), bold white sans + black outline or dark pill, current word yellow, occasional big coloured punch word | phrase captions, 3 styles (bar/pill/outline), word highlight |
| Loudness | -12 to -15 LUFS, voice dry and close, music low | -14 LUFS two-pass loudnorm, ducked music (QA band is the same) |
| Numbers | animated counters on objects, arrows and callouts with leader lines | big_number/stats counters; leader-line callouts NOT yet built |
| Narration | 150-170 wpm, no pause above 0.4 s, hook in the first second with a moving visual | QA: 140-180 wpm, longest pause limit in LIMITS |

## Not built yet (needs its own project)
Full-bleed Shorts mode with procedural 3D/2.5D scenes (@remotion/three), `visual` sequences on word timestamps, a 2-3 word punch-word caption preset, a `shorts-pro` pacing profile, procedural music beds, CC0 asset import with assets/LICENSES.md.
