# Stock footage and the visual system

Order of truth for a beat's picture: real stock photo/video (Pixabay, else Openverse/Wikimedia) -> drawn full-bleed subject (src/fullbleed) as overlay or fallback.

## Flow
1. **Storyboard** (`src/draft/storyboard.ts`): per beat the model writes `shot` (subject, action, setting, label, mood, camera) and `stock {query, kind}` (English, 2-4 words). Code (`pickStock`) keeps 40-55% of beats on stock, never the same query within 8 beats, data beats (`big_number`, `chart`) stay drawn, and fills gaps with `setting + subject` queries.
2. **Fetch** (`npm run direct` runs it first; `npm run stock -- <id>` alone): `STOCK_PROGRESS i/n query` lines, cache in `assets/stock-cache/`, API answers cached 24 h, idempotent (unchanged query + file present = kept), never fatal. `STOCK=0` disables. No key / no hit = the beat stays procedural, silently.
3. **Render**: `render.ts` injects `scene.stockFile`; `StockLayer` does Ken Burns (photo), looped/cropped clip (video, `prepVideo`), palette tint. Layout `broll`/`pip` for stock beats.
4. **Credits**: `stock.json` -> `publish` description ("Images and footage").
5. **Swap image** backend: `searchStock()` (ranked candidates) + `chooseStock()` (rewrites one beat's record). Studio grid is a UI task.

## Theme packs
`src/fullbleed/objects5.tsx`: shoe, dumbbell, stopwatch, medal, heart, apple, pill, drop, plane, globe, suitcase, mountain, laptop, chip, book, flask, atom, sprout, sun, burger. Groups in `catalog.ts` (sport, health, travel, tech, food, science); English keyword rules in `shots.ts`. The variety fallback tries the topic's own groups before any money subject.

## Measuring
`npm run qa:semantic -- <id>` -> median/mean + weakest beats; `--fix` re-chooses beats below `--below 6` (drops stock or swaps the subject), then `npm run direct` + `npm run render`.
`npm run qa:restoryboard -- <id> <new-id>` re-runs the storyboard on a copy (same script and voice) for before/after numbers.

## Note for the stock/visuals owner: off-topic backgrounds (ep010, 2026-11-26)
`ep010-why-the-minimum-credit` (EN Short, credit-card minimum payments): the hook beat got a photo of a cozy living room
(`stock.query` = "living room debt counter"). Cause: the query is built as `<setting> <subject>` and the setting ("Living room",
copied into every beat) dominates the search, so the photo matches the room, not the idea. Same pattern in beats 3 and 7
("living room percent", "living room gauge"): none of those pictures say "debt" or "interest".
Suggested fix: build `stock.query` from the sentence's concrete noun + the topic keyword (e.g. "credit card bill", "interest rate"),
never from `setting`; drop hits whose title/tags share no word with the topic; keep the procedural object when no hit overlaps.

## B2 notes (ep011, 2026-11-26, Groq draft, 52.5 s)

QA: 16/18 pass. Fails: visual change rate 3.8 s (cap 3 s, 14 changes) and longest scene 7.9 s. The scene length is fixed on the B2 side (de6dad5: spoken word counting, Short data scenes > 14 spoken words go back to the drafter). The change rate is planShots: most beats get one shot. Owner: A2.

Visual, from a contact sheet (every 4 s):
- Hook mug shows "$6" while the voice says $5: the label number should come from the narration.
- Off-topic stock: a child watching TV for "the average American", empty goal posts for "habit quietly eats", a grey splash for "days".
- The lower ~35% of the frame is a dark empty band under the captions.
- Captions read "ONE THOUSAND EIGHT HUNDRED": the drafter writes numbers as words, so captions lose the numerals. The prompt should ask for numerals ($1,825); TTS spells them out anyway.
- Script: $1,825 is said four times in the 12 beats. Story variety (A2: story.ts/outline).

### B2 notes (ep012-steps: fresh Groq draft, health topic, 55.8 s)

QA 15/18. Fails: pace 176 wpm (cap 175), visual change rate 3.5 s, longest scene 6.6 s. The scene length is fixed on the B2 side in 49c8ca9: a long data scene is split into a talk beat. Captions now show numerals and break on sense units ("ADVERTISED AS OPTIMAL HEALTH").

For A2:
- Gauge bug: the label reads "7497.9%" and "8104.4%". A step count (7,500 / 10,000) is fed to the gauge as a percent; a gauge should show only real percentages, or the raw number without %.
- The CTA says "Follow Money Myths" on a health video. The series/channel name comes from the default channel; the outro should use the channel name or none.
- An orange-robed monk stock photo for "around 7,500 steps": an off-topic person. Prefer a walking/feet/sneakers query.
- Change rate: most talk beats show a single shot.

## Measurements (2026-11-26, EN, qwen2.5vl:7b semantic QA; the 7B scorer is coarse and noisy: the same picture moved 7 -> 5 between runs)
| episode | stock | semantic median | mean | picture-change gap (ffmpeg scene > 0.06) |
|---|---|---|---|---|
| ep011 coffee, before (old queries, no topic gate) | 6/12, mostly off-topic (calendar, cuckoo clock, family TV, clothing tag) | 5 | 5.7 | mean 4.25 s, max 11.7 s |
| ep011-v2 coffee, after (topic in storyboard prompt, topic gate, dedupe, sub-shots) | 6/12, all coffee photos | 6 | 6.1-6.3 | mean 1.97 s, max 4.73 s |
| en-sleep, baseline (keyless) | 6/13 | 5 | 4.0 | - |
| en-sleep-v3 (Pixabay, old queries) | 6/13, hands/dictionary/rocket | 5 | 4.23 | - |
| en-sleep-v4 (topic gate, sleep b-roll) | 7/13 sleep photos | 5 | 4.0-4.8 | - |
Abstract science sentences ("slow-wave sleep cements facts") score 0 with any drawn object; on-topic footage scores 5-8. Target median >= 7 is not reached yet.

## Episode-mode stock rules (src/stock/index.ts)
Every hit must carry a title word of the episode (topic gate); text/logo/fashion hits and animals/babies (unless asked) are dropped; the match must come
from the query's non-topic words; tries narrow: full query -> woman/man for "person" -> topic + 2 words -> topic + last word -> topic + woman/man -> topic alone
(topic must lead the tags); one picture once per video; keyless archives are skipped when Pixabay is keyed.

## Vision check of candidates (2026-11-27, src/stock/index.ts `vlmScore`)
The top 4 ranked hits of every try are scored by the local qwen2.5vl:7b (free, Ollama) on their preview image cropped to what the frame shows
(centre 9:16 of a landscape clip in a Short), against the beat's sentence; best score wins, below 5 ("unrelated") is rejected, at most 10 checks per beat,
then the drawn subject stays. Scores are cached in assets/stock-cache/vlm/. On for `npm run stock` / direct when the model is pulled (STOCK_VLM=0 turns it off);
callers that pass their own env (tests) opt in with STOCK_VLM=1. Shorts take Pixabay's large (1920) file so the 9:16 crop is not a 405 px upscale;
`isLowQuality` clips are skipped, clips >= 8 s rank up, < 5 s down; prepared clips start 1 s in (fade-ins, slates). Timeline beats get no stock (their dated
callouts need the drawn growth picture). The 7B model is coarse: it answers 0 or 5 for most thumbnails, so it mainly removes the clearly wrong ones
(a CPU socket for "put the phone in your pocket", a corridor for "five dollars times 365").
| episode | stock before -> after | semantic median |
|---|---|---|
| ep011-v3 coffee | 6 beats (incl. cash clip on "if you invested", corridor man) -> 4 (coffee mug, coffee clip, espresso, jar; corridor kept at 5) | 5 -> 6 |
