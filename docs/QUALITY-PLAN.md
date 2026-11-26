# Top-tier quality plan (EN Shorts first, then 16:9)

Goal: a viewer can't tell the video was made by a machine, and keeps watching. Every item is free (free tiers, local models, CC0/MIT/Apache/CC-BY assets). Each step ends with a measurement; a step is done only when its number is reached.

Lanes: **A** = visual (src/fullbleed, src/fx, src/visuals, src/stock, outline/storyboard, scripts/qa). **B** = script/voice/infra (src/director, src/pipeline, src/draft/*, src/llm, src/assets, scripts/assets, studio).

## The bar (what "top tier" means, measured)
| Area | Target | Check |
|---|---|---|
| Hook | first 1 s: moving picture + a specific claim, <12 spoken words, judge >= 75 | hook judge, contact sheet frame 0 |
| Retention structure | open loop in the hook, closed in the last beat; a new reason to stay every 8-10 s | lint (story devices), manual |
| Pace | 150-170 wpm, no pause > 0.4 s, Short 35-55 s | npm run qa |
| Picture | shows exactly what is said; semantic median >= 7 (3-run mean) | qa:semantic |
| Change rate | new picture every 2-3 s, never the same look twice in a row | qa change rate, variety stats |
| Motion | at most one visible move at a time; stock video still-framed; photo move <= 4.5%; no stacked zooms | frame-diff zoom metric (new QA check) |
| Captions | 9:16 safe zone (above bottom 420 px), <= 2 lines, <= 17 cps, one accent colour | caption-styling checker |
| Sound | -14 LUFS, TP <= -1, voice dry/close, music ducked 12-18 dB under voice, SFX tied to picture, no SFX on > 1/3 of cuts | qa loudness + sfxAudit |
| Voice | no robotic prosody: emphasis on the number/key word, natural breath gaps | listening test + pause stats |
| Truth | every number sourced or computed; no invented figures on screen | draft number checks, objects show real `value` only |

## Phase 1 - feel (now; fixes what reads as "AI")
1. **A: motion discipline** - done in 89985b3 (stock still, photo <= 4.5%, push <= 6%). Add a QA check that measures zoom per beat from frames so it can't regress.
2. **A: stock selection** - several candidates per beat, local qwen2.5vl scores thumbnails against the sentence, best wins; portrait/1080p/no text; start at the clip's most active part; no repeats, similar grade.
3. **A: one colour grade per video** - one LUT-like grade (saturation/contrast/temperature) applied to stock and drawn scenes so footage from 10 sources looks shot together.
4. **B: hook system** - done in fe504e4 (5 formula candidates + judge). Verify on 3 drafts; pair each spoken hook with a 5-7 word overlay.
5. **B: pace + length** - 35-55 s, 150-170 wpm, measured on 3 Groq drafts.

## Phase 2 - richness (kills the monotony)
6. **B: asset library** - done in b3537fc (Fluent Emoji 3D, Noto Lottie, Open Peeps...). Grow by tags coverage: every common noun in 20 sample scripts should find an asset.
7. **A: wire assets into scenes** - characters doing/reacting to the action in ~1/3 of beats, Lottie for animated moments, 8+ environments rotating; variety stats: no look repeated within 3 beats.
8. **A: scene language** - a small grammar a human editor uses: establishing wide -> detail close-up -> reaction; match cuts on shape/colour; split-screen for compare; map/route for travel; UI mock (phone/app screen) for tech; data on objects, not on slides.
9. **A: kinetic typography** - punch words as designed graphics (size/weight/colour contrast, occasional word-by-word build), max 1 per 6-8 s.
10. **B: sound design** - CC0 SFX library (Kenney, freesound CC0 filter, Sonniss GDC bundles) indexed by tag; layered cues (whoosh + low thump on scene change, paper/click for UI, coin for money); risers before the payoff; 2-3 frames of silence before a big reveal.
11. **B: music** - beds that follow the story: tension under the problem, lift at the payoff, button at the end; beat-aligned cuts (cut points snapped to the bed's beat grid when within 80 ms). Sources: procedural beds + a local drop folder for YouTube Audio Library / Pixabay Music tracks (free, manual download, license noted).
12. **B: voice** - evaluate free local TTS with more natural prosody (Chatterbox - check MIT license; Kokoro voices; piper) on the same 3 scripts; emphasis tags on numbers/key words; sentence-level speed variation; breath/room tone. Keep the best per voice, local fallback always.

## Phase 3 - content and packaging (why people click and share)
13. **B: topic selection** - YouTube Data API (free 10k units/day) for outliers in the niche: views/subscriber ratio, last 30 days; score ideas by outlier signal + searchability + "can we show it"; feed the ideas list.
14. **B: story quality** - one surprising fact per video, a concrete person/example in the middle, a counter-intuitive turn, the ending pays off the hook; "would a friend repeat this?" judge >= 75.
15. **B: title + description + pinned comment** - 5 title candidates, judge (curiosity + clarity, <= 50 chars), chapters for long-form.
16. **A: thumbnail (long-form) / cover frame (Shorts)** - one face/object, 3 words max, high contrast; generated from the best frame + designed text.
17. **B: retention loop** - after publish, scene retention (src/analytics) drives the next drafts: beat types/devices where viewers drop get penalised.

## Phase 4 - 16:9 long form at Shorts level
18. **A: wide layouts** - the same scene language reframed for 16:9 (rule of thirds, side callouts, b-roll + drawn overlay), chapters with title cards, slower 4-6 s cadence but never a static picture.
19. **B: long-form script** - 6-10 min outline: cold open, promise, 3-5 chapters each with its own mini-hook, mid-roll re-hook, recap + CTA; 140-160 wpm.
20. **A+B: golden + QA for 16:9** - its own limits in scripts/qa, golden frames, semantic QA.

## Working rules
- One step at a time per lane; each step: implement -> render ep011 + one non-money topic -> contact sheet (scripts/qa/stills.ts) -> numbers -> commit + push.
- Before/after numbers go into the commit message or docs/STOCK.md; the main agent compares them against "The bar".
- Never a paid service; a free external service always has a local fallback.
