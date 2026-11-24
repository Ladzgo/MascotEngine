# Project brief: "Mascot Engine": automated, non-template educational finance videos

> Paste this whole file as your first message in Claude Code (or save it as
> `CLAUDE.md` in an empty project folder). **Talk to me in Hungarian**; keep code,
> comments, file names and on-screen video text in English.

---

## 0. How I want you to work

1. **Read this entire brief first.** Then ask me only the questions in section 11
   ("Open decisions") that you actually need answered before you start. Don't
   ask anything this brief already answers.
2. Propose a short implementation plan (milestones from section 10) and wait for
   my OK before writing large amounts of code.
3. Build in small, runnable steps. After each milestone: render a short test
   video, look at a few extracted frames yourself, and tell me what works and
   what doesn't.
4. Prefer boring, reliable tech. No paid APIs are required to get the MVP
   running; paid services (TTS) must be optional plug-ins behind an interface.
5. Keep a `docs/DECISIONS.md` log of non-obvious choices.
6. Never hard-code secrets; use `.env` + `.env.example`.

---

## 1. What we are building and why

I'm starting an **English-language, faceless, educational YouTube channel** in
**personal finance / money** (high-RPM niche). The channel's on-screen star is a
**simple hand-drawn mascot character**. Around it I want an **automated
production system** that turns a script into a finished, professional-looking
video, where **every video looks and feels a bit different**, so the channel
never reads as template-made "AI slop".

### Why finance + mascot (research summary, Nov 2026)
- Finance/insurance content earns the highest YouTube RPM, roughly **$8–25 per
  1,000 views for US audiences**, top channels $30+; gaming/entertainment is
  ~$1–5. English + Tier-1 audience is the point of the whole thing.
- Proven formats close to this idea:
  - **Casual Finance**: stick-figure finance explainers, ~433K subs in ~1.3
    years, est. $6–19K/month, engagement ~3x finance average. Strength: topic
    angle (macro risks *before* they hit headlines), not the drawing quality.
  - **The Swedish Investor**: hand-drawn book summaries on investing, ~1M subs,
    but growth has stalled: plain book summaries are saturated. Lesson: need a
    fresh angle.
  - **Casually Explained** (4M+): ultra-simple stick figure + dry, academic
    narration. Lesson: character + voice/tone > drawing skill.
  - **Kurzgesagt**: premium end; few, very polished videos; memberships + shop.
- Counter-example to avoid: mass-produced AI cartoon channels. YouTube's
  **"inauthentic content"** policy (renamed July 2025, tightened July 2026 into
  three demonetizable categories) targets content that "looks like it's made with
  a template with little to no variation across videos, or content that's easily
  replicable at scale."

### The core principle (non-negotiable)
**Variation must come from the content, not from randomness.** Random zooms and
transitions on top of the same structure are still a template. The system must:
- derive visual decisions from what each scene *says* (a surprising number gets a
  punch-in and a shocked pose; a comparison gets a split layout; a process gets a
  timeline), and
- remember what it used in previous episodes and actively avoid repeating
  combinations, while
- keeping a consistent, recognizable channel identity (character, line style,
  fonts, tone).

The human (me) owns: topic choice, the angle/opinion, final script edit, and a
final approval pass. AI/automation owns: research drafts, script drafts,
assembly, timing, motion, sound design, captions, rendering.

---

## 2. Visual identity

- Look: hand-drawn ink illustration on paper. Slightly wobbly black outlines of
  consistent thickness, flat colours, limited palette, subtle paper texture.
- **"Line boil"**: outlines re-jitter every 2–4 frames (classic hand-drawn
  animation feel). Must be seeded/deterministic.
- Fonts: one display font for big numbers/titles (e.g. Archivo Black), one clean
  sans for labels/captions (e.g. Poppins). Choose open-licensed fonts and bundle
  them in `assets/fonts/`.
- Palette: paper off-white background, ink near-black, **one accent colour per
  episode**, chosen by the director from a curated set (avoid repeating the
  last 3 episodes' accents).
- Background variants per episode: plain paper / grid paper / dot paper / soft
  vignette, chosen with history.
- Format: 1920×1080, 30 fps, H.264 + AAC. Later: 1080×1920 Shorts cut-downs
  from the same scene data (milestone 6).

---

## 3. The character (mascot)

I will generate the poses myself with an external image AI (I'll use the prompts
in Appendix A). The engine must work **before** real art exists:

- Build a **procedural placeholder mascot** (drawn in code): round/egg-shaped
  body, big eyes, stubby arms, accent-coloured tie. Expressions via brows,
  pupils, mouth; poses via arm positions; extras like a sweat drop.
- **Asset loader**: if `assets/character/<pose>.png` exists, use it; otherwise
  use the placeholder for that pose. Mixed real/placeholder must work.
- `assets/character/manifest.json` maps pose → file, tags (emotion, direction it
  faces/points), and optional `_talk` (mouth open) frame.
- Animation on top of static poses: idle bob (sine), occasional blink
  (placeholder only, or `_blink` frames if provided), squash-and-stretch on
  entry, mouth flap between `pose` and `pose_talk` while narration is active
  (driven by audio amplitude if available, else by word timings).
- Pose selection is content-aware: `emotion` from the script → candidate poses;
  if the character stands left of a chart it uses `explain_right`, etc. Avoid the
  same pose in consecutive scenes.

Core pose list (filenames): `neutral, explain_left, explain_right, pointing_up,
thinking, happy, excited, thumbs_up, smug, worried, shocked, sweating, sad,
angry, confused, facepalm, counting_money, holding_sign, reading, writing`.

File spec: transparent PNG, 1200×1500, character centred, feet on the bottom
edge, identical scale/line weight across all poses, no shadow/background/text.

---

## 4. Architecture

```
topic → research draft → script (human edits) → episode.json
      → TTS + word timestamps → director (decisions + history)
      → renderer (scenes, camera, transitions, captions, SFX, music)
      → preview → human approval → final render (+ Shorts cut-downs)
      → analytics feedback (later)
```

### Recommended stack
- **Remotion (React + TypeScript)** for rendering: programmatic, frame-exact,
  great for parameterised scenes, preview in browser (`remotion studio`).
- **Node/TypeScript** for the pipeline CLI and director.
- **ffmpeg** for audio mixing/muxing and Shorts reframing.
- **TTS interface** with adapters:
  - `ElevenLabsTTS` (returns character/word timestamps), optional, needs key.
  - `LocalRecordingTTS`: I record my own voice per scene; timings via forced
    alignment with **whisper / whisperX** (word-level timestamps).
  - `SilentTTS`: estimated timings (~2.6 words/sec) for fast previews.
- If you think a Python renderer (PIL/skia + ffmpeg) is clearly better for some
  part, argue it in DECISIONS.md, but default to Remotion.

### Suggested layout
```
mascot-engine/
  episodes/<id>/episode.json      # script + scene data (source of truth)
  episodes/<id>/audio/            # narration per scene (generated or recorded)
  episodes/<id>/build/            # timings.json, decisions.json, renders
  assets/character/  assets/props/  assets/sfx/  assets/music/  assets/fonts/
  src/director/       # decision engine + history
  src/scenes/         # one React component per scene type
  src/character/      # placeholder mascot + asset loader + animation
  src/fx/             # camera, transitions, line-boil, captions
  src/pipeline/       # CLI: tts, align, direct, render, shorts
  data/history.json   # what the director used in past episodes
  docs/DECISIONS.md
```

---

## 5. Episode schema (source of truth)

Define with **zod** and validate on load. Example:

```json
{
  "id": "ep001-inflation",
  "title": "Why Your Savings Are Quietly Shrinking",
  "series": "money-myths",
  "scenes": [
    { "type": "title", "narration": "Your savings account is lying to you.", "emotion": "smug" },
    { "type": "talk", "narration": "The number goes up, but what it can buy goes down.",
      "emotion": "worried", "emphasis": ["goes down"] },
    { "type": "big_number", "narration": "At three percent inflation, ten thousand dollars buys about seven thousand four hundred dollars' worth of stuff ten years from now.",
      "value": 7441, "prefix": "$", "label": "real value of $10,000 after 10 years at 3% inflation",
      "emotion": "shocked" },
    { "type": "chart", "narration": "Here's what that slide looks like year by year.",
      "chart": { "kind": "line", "labels": ["0","2","4","6","8","10"],
                 "values": [10000, 9426, 8885, 8375, 7894, 7441], "yLabel": "buying power ($)" },
      "emotion": "explaining" },
    { "type": "compare", "narration": "Meanwhile the average savings account pays a fraction of that.",
      "left": { "title": "Typical savings rate", "value": "0.5%" },
      "right": { "title": "Inflation", "value": "3%" }, "emotion": "angry" },
    { "type": "list", "narration": "So what can you actually do? Three things.",
      "items": ["High-yield savings for your emergency fund", "Invest long-term money", "Stop letting cash pile up"],
      "emotion": "thinking" },
    { "type": "talk", "narration": "Let's go through each one.", "emotion": "happy" }
  ],
  "sources": ["https://..."],
  "disclaimer": true
}
```

Scene types for the MVP: `title, talk, big_number, chart (line|bar), compare,
list`. Next: `timeline, quote, map, process_flow, myth_vs_fact, calculator`
(animated formula), `sign` (character holds a sign with text).

Optional per-scene overrides (`layout`, `camera`, `transition`, `pose`) let me
force a choice; otherwise the director decides.

All numbers shown on screen must come from the episode file (never invented by
the renderer), and each episode lists `sources`. Add an automatic end-card
disclaimer ("educational, not financial advice") when `disclaimer: true`.

---

## 6. The director (the part that makes every video different)

Input: validated episode + word timings + `data/history.json`.
Output: `build/decisions.json` (human-readable, and I can edit it before render).

Per episode it chooses: accent colour, background variant, music mood/track,
caption style variant, intro style.
Per scene it chooses:
- **layout** (e.g. talk: `center | keyword_side | closeup | over_shoulder`;
  chart: `char_left | char_right | char_corner | fullscreen`)
- **pose** (from emotion + layout direction)
- **camera** (`static | slow_push | slow_pull | pan_left | pan_right | drift`,
  plus **punch-ins** on `emphasis` words and on surprising numbers)
- **transition in** (`cut | slide | wipe_ink | circle_reveal | zoom_through | paper_flip`)
- **SFX cues** (pop on element appear, whoosh on transition, ticks while a
  number counts, ding on payoff), with variant selection so the same sample isn't
  used every time
- **element timing** (when list items / chart points appear, synced to the
  words that mention them; use word timestamps, don't space evenly)

Scoring for each choice:
`score = content_fit(choice, scene) × seeded_noise × penalty_prev_scene ×
penalty_history_frequency`
- `content_fit`: rule table (shocked + big_number → punch_in high; list →
  static/slow_push; compare → split layouts…).
- `penalty_prev_scene`: strong penalty for repeating the previous scene's
  layout/side/transition/camera.
- `penalty_history_frequency`: penalise choices overused in the last N=5
  episodes; also penalise repeating the **same sequence** of scene treatments
  as a past episode (compare n-grams of (type, layout, camera)).
- Deterministic: seeded by episode id, so re-renders are identical unless I
  bump the seed.
- `--preview` must not write to history; only `--final` does.

Also produce a **variety report** after each render: how different this episode
is from the last 5 (simple distance over the decision vectors), so I can see
it's not drifting into sameness.

---

## 7. Rendering details

- Line boil on all drawn strokes (charts, boxes, underlines, placeholder mascot).
- Charts draw on progressively (line traced, bars grow), axes hand-drawn.
- Big numbers count up with easing and tick SFX; final value lands with a pop.
- Captions: phrase-level (≤ ~6 words) with the current word highlighted in the
  accent colour; position avoids covering the chart/character; 2–3 style
  variants chosen by the director per episode; burned-in, plus export `.srt`.
- Transitions use the previous scene's last frame.
- Camera applies to the scene layer, not to captions.
- Audio: narration + music bed with **sidechain-style ducking** under the voice
  + SFX; loudness-normalise the final mix to about −14 LUFS.
- Music/SFX: only royalty-free/licensed files I put in `assets/`; keep a
  `assets/LICENSES.md`. For the MVP, synthesise simple SFX (pop, whoosh, tick,
  ding) in code so it works out of the box.
- Render a 720p `--preview` quickly; `--final` at 1080p.

CLI target:
```
npm run new -- ep002-compound-interest        # scaffold episode folder
npm run tts -- ep001 [--engine eleven|local|silent]
npm run direct -- ep001                        # writes decisions.json
npm run render -- ep001 --preview|--final
npm run shorts -- ep001                        # 9:16 cut-downs of best scenes
```

---

## 8. Script-writing helper (later milestone)

A `npm run draft -- "topic"` command that uses the Claude API to produce a
**draft** `episode.json` in our schema: hook in the first 5 seconds, one clear
angle, 6–12 minutes for long form, scene types chosen to fit the content, every
number with a source URL. It's a draft; I always rewrite it. Include a style
guide file (`docs/VOICE.md`) for the channel's tone (casual, dry humour, no
hype, no guaranteed-returns language) that the drafter must follow.

---

## 9. Quality bar / acceptance criteria for the MVP

- `ep001` (the example above) renders end to end with the placeholder mascot
  and silent TTS, with no manual steps.
- Rendering the same episode twice gives identical output (determinism).
- Render two different example episodes → decisions differ visibly (layouts,
  camera, transitions, accent, background) while the style stays recognisably
  the same channel.
- Dropping one real PNG (e.g. `worried.png`) into `assets/character/` makes
  that pose use the real art with no code change.
- On-screen numbers exactly match the episode file.
- Extract frames at a few timestamps and inspect them yourself: no clipped
  text, no overlapping elements, captions readable.

---

## 10. Milestones

1. Project scaffold, schema + validation, example episodes (ep001 inflation,
   ep002 compound interest), silent TTS timings.
2. Placeholder mascot + asset loader + character animation.
3. Scene components (title, talk, big_number, chart, compare, list) with line boil.
4. Director + history + decisions.json + variety report.
5. Camera, transitions, captions (+ .srt), synthesised SFX, audio mix → full MVP render.
6. Real TTS adapters (ElevenLabs, local recording + whisper alignment), music
   ducking, loudness normalisation, Shorts cut-downs.
7. Script drafter (Claude API) + `docs/VOICE.md`.
8. Later: topic/trend scout, analytics feedback loop (which scene treatments
   keep retention), more scene types.

---

## 11. Open decisions (ask me only these, if needed)

- Voice: my own recorded voice, or an AI voice (ElevenLabs)? (Build both
  adapters regardless; I need to pick for ep001.)
- Channel name and the mascot's name/personality (I may still be deciding;
  use placeholders).
- Exact sub-niche/angle (e.g. "money myths", "how the system quietly costs you
  money", "finance for people who hate finance"). Use "money myths" as the
  working series until I decide.
- My OS and whether ffmpeg/Node are installed. Check yourself first and only ask if
  something's missing.

---

## Appendix A: prompts I use to generate the character poses externally

**Step 1: character sheet**
```
Character design sheet for an educational finance YouTube channel mascot.
Character: [a small, round, egg-shaped creature with a single curl of hair on
top, oversized expressive eyes, tiny stubby arms and legs, wearing a slightly
too-big green tie].
Style: hand-drawn ink illustration, slightly wobbly confident black outlines of
consistent thickness, flat colours with a limited palette (off-white body, one
accent colour), subtle paper-texture feel, no gradients, no 3D, no realistic
shading. Simple enough to redraw in many poses; readable at small sizes.
Show: front view, three-quarter view, side view, and 6 facial expressions
(neutral, happy, worried, shocked, smug, thinking) in a clean grid on a plain
white background. No text, no logos.
```

**Step 2: one pose at a time (attach the chosen sheet as reference)**
```
Using the attached character as the exact reference (same proportions, same
line weight, same colours, same tie), draw a single full-body pose.
POSE: [worried — hands pressed together near the mouth, eyebrows raised in the
middle, small sweat drop, body slightly leaning back].
Full body, centred, facing the viewer in three-quarter view, entire character
visible with the bottom of the feet touching the lower edge of the frame.
Plain pure white background (will be removed), no shadow, no props unless the
pose mentions one, no text. Portrait 4:5 aspect ratio.
```
**Talking frame:** `Same image, identical in every way, except the mouth is open mid-word.`

**Clean-up:** remove background (remove.bg / rembg), pad to 1200×1500 on a
shared baseline, save as `assets/character/<pose>.png` (+ `<pose>_talk.png`).
Then put all poses side by side and regenerate any that drift in tie, eye size,
or line thickness.

Please build a helper script `npm run assets:check` that validates the folder:
sizes, transparency, baseline (lowest opaque pixel row), and missing poses.
