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
