# Mascot prompt pack (paste into your image AI)

Pipeline: pick a concept (1), generate the sheet, then one pose at a time with the sheet attached (2, 3). Specs and cleanup: `docs/MASCOT-ART.md`. Voice reference: `docs/VOICE.md` (casual, dry, no hype).

Shared rules for every prompt below:
- Egg-shaped body, hand-drawn ink look, slightly wobbly black outline of one constant thickness, flat colours, no gradients, no shading, no 3D, no text, no logos.
- Palette: off-white body, near-black ink, ONE accent colour. The accent changes per episode, so draw the accent element (tie / scarf / cap, see each option) as one flat, fully enclosed colour region with its own outline, touching nothing else of that colour. Nothing else on the character may use the accent hue. Use a neutral mid-green (#2E9E6B) as the stand-in accent so it can be recoloured later.
- Eyes, mouth and brows are part of the ink line work, not colour regions. Body stays off-white (#F4F1E8) everywhere.

## 1. Three concept options (step 1: character sheet)

Suffix for all three (append after the Character line):
```
Style: hand-drawn ink illustration, slightly wobbly confident black outlines of
consistent thickness, flat colours, limited palette (off-white body, near-black
ink, one flat green accent used ONLY on the [ACCENT ITEM]), subtle paper-texture
feel, no gradients, no 3D, no realistic shading. The accent item is a separate
flat colour region with its own outline so it can be recoloured. Simple enough to
redraw in many poses; readable at small sizes.
Show: front view, three-quarter view, side view, and 6 facial expressions
(neutral, happy, worried, shocked, smug, thinking) in a clean grid on a plain
white background. No text, no logos.
```

### Option A: "Penny" (the deadpan accountant)
Personality: calm, unimpressed, dry. Raises one brow at everything, never panics, delivers the punchline flat.
```
Character design sheet for an educational finance YouTube channel mascot.
Character: a small, tall-ish egg-shaped creature (taller than wide, about 1.3:1),
single curl of hair on top, two big round eyes with small pupils and heavy half-lids,
one slightly higher eyebrow, tiny stubby arms and legs, wearing a slightly too-big
necktie (the accent item: flat solid shape, clearly separate from the body).
```
Silhouette: tall egg, curl on top, tie triangle at the chest.

### Option B: "Bean" (the wide-eyed friend)
Personality: curious, a bit naive, asks the obvious question, gets quietly alarmed by the numbers. Warm, never loud.
```
Character design sheet for an educational finance YouTube channel mascot.
Character: a small, short and wide egg-shaped creature (nearly as wide as tall),
no hair, two very large oval eyes with big glossy-free pupils, thick expressive
eyebrows, tiny stubby arms and legs, wearing a chunky knitted scarf wrapped once
around the neck with one short tail (the accent item: flat solid shape, separate
from the body).
```
Silhouette: squat egg, scarf band and a single tail.

### Option C: "Moth" (the smug know-it-all)
Personality: confident, mildly smug, dry wit, secretly nervous about big numbers. Explains with a tiny smirk, never gloats.
```
Character design sheet for an educational finance YouTube channel mascot.
Character: a small egg-shaped creature slightly pointed at the top, two small
sharp-edged eyes with heavy upper lids, one-sided smirk, a tiny pair of round
glasses drawn in ink only (no colour fill), tiny stubby arms and legs, wearing a
small flat baseball cap tilted slightly (the accent item: flat solid shape,
separate from the body).
```
Silhouette: egg with a cap brim sticking out to one side.

Pick one, regenerate until front, three-quarter, side and the 6 faces are consistent, then use that sheet as the fixed reference. Note the chosen name and accent item: replace `[CHARACTER]` and `[ACCENT ITEM]` below.

## 2. Step-2 prompt template (fixed)
Attach the chosen sheet every time. Only the POSE line changes.
```
Using the attached character as the exact reference (same proportions, same
line weight, same colours, same [ACCENT ITEM] in the same green), draw a single
full-body pose.
POSE: [pose description from section 3].
Full body, centred, [facing direction from the pose], entire character visible
with the bottom of the feet touching the lower edge of the frame. Keep the body
size and eye size identical to the reference. The [ACCENT ITEM] stays one flat
solid colour region. Plain pure white background (will be removed), no shadow, no
props unless the pose mentions one, no text. Portrait 4:5 aspect ratio.
```
Talking frame (send right after in the same chat, or re-attach the pose):
```
Same image, identical in every way (pose, outline, colours, position, size),
except the mouth is open mid-word.
```

## 3. The 20 pose prompts
Paste each line as the POSE text. "Talk:" is the `_talk` mouth variant for that pose (use it as the second prompt, with the pose image attached). Facing: "front" = toward viewer, "3/4 L" = three-quarter view turned toward viewer's left, etc. explain_left / explain_right name the side the character gestures toward (the director uses explain_right when the character stands left of the content).

1. neutral
   `neutral - standing relaxed, both stubby arms hanging at the sides, eyebrows level, mouth a small flat line, eyes looking at the viewer. Front view. No props.`
   Talk: closed flat line becomes a small open oval, upper teeth not shown.
2. explain_left
   `explain_left - the character's left-pointing arm (viewer's left) raised out to the side, open palm up as if presenting something, other arm relaxed, eyebrows slightly raised, mouth a small smile. Body turned three-quarter toward viewer's left, eyes on viewer. No props.`
   Talk: mouth open in a medium oval.
3. explain_right
   `explain_right - the arm on the viewer's right raised out to the side, open palm up as if presenting something, other arm relaxed, eyebrows slightly raised, small smile. Body turned three-quarter toward viewer's right, eyes on viewer. No props.`
   Talk: mouth open in a medium oval.
4. pointing_up
   `pointing_up - one stubby arm raised straight up with a single finger pointing up, other arm at the side, one eyebrow raised, mouth a small knowing smile. Front view, eyes on viewer. No props.`
   Talk: mouth open mid-word, slightly wider.
5. thinking
   `thinking - one stubby hand on the chin, other arm across the belly supporting the elbow, eyes looking up and to the side, eyebrows uneven (one lowered, one raised), mouth a small flat squiggle. Body three-quarter view. A single small thought-free pose: no bubbles, no props.`
   Talk: mouth a small open oval to one side.
6. happy
   `happy - both arms slightly raised and open, eyes closed in happy arcs or wide open with raised cheeks, eyebrows raised and relaxed, mouth a big open smile. Front view. No props.`
   Talk: smile opens wider with a visible dark mouth interior.
7. excited
   `excited - both arms thrown up high, small hop (feet barely off the ground but still touching the bottom edge), eyes wide, eyebrows high, mouth wide open in a big grin. Front view. Three tiny motion ticks beside the head are allowed in ink only. No props.`
   Talk: mouth open even bigger, mid-shout.
8. thumbs_up
   `thumbs_up - one arm extended forward showing a thumb up (stubby fist, thumb clearly visible), other arm at the side, one eyebrow raised, mouth a confident small smile. Front view, slight lean back. No props.`
   Talk: mouth open mid-word.
9. smug
   `smug - arms crossed over the belly, chin slightly raised, eyelids half closed, one eyebrow raised, mouth a one-sided smirk. Three-quarter view toward viewer's right, eyes glancing sideways at the viewer. No props.`
   Talk: smirk opens into a small lopsided oval.
10. worried
    `worried - both hands pressed together near the mouth, eyebrows raised in the middle and slanted down at the outer ends, eyes wide with small pupils, mouth a short wavy line, one small sweat drop on the forehead (ink outline, very pale blue or off-white, no accent colour), body slightly leaning back. Three-quarter view.`
    Talk: wavy mouth opens into a small trembling oval.
11. shocked
    `shocked - both arms raised with hands near the cheeks, eyes huge and round with tiny pupils, eyebrows very high, mouth a large open oval, body tilted back slightly, three small shock lines above the head in ink. Front view. No props.`
    Talk: not needed visually different; make the mouth the widest oval, jaw dropped.
12. sweating
    `sweating - one hand wiping the forehead, other arm hanging, eyes narrowed and nervous, eyebrows slanted up in the middle, mouth a tight wobbly line, two sweat drops flying off the head (ink outline only). Body slightly hunched. Three-quarter view.`
    Talk: tight line opens into a small tense rectangle.
13. sad
    `sad - shoulders slumped, both arms hanging limp, head tilted down slightly, eyebrows slanting up in the middle, eyes looking down, mouth a small downturned curve. One small tear optional (ink outline). Front view. No props.`
    Talk: mouth a small open frown, downturned.
14. angry
    `angry - both arms bent with small fists at the sides, eyebrows lowered and angled sharply toward the nose, eyes narrowed, mouth a tight grimace with teeth showing as a straight line, body leaning slightly forward. Front view. No props.`
    Talk: grimace opens into a wide clenched shout.
15. confused
    `confused - one hand scratching the top of the head, other arm hanging, head tilted to one side, eyebrows uneven, eyes looking up, mouth a small crooked wave. A small question mark drawn in ink above the head is allowed. Front view.`
    Talk: crooked mouth opens slightly.
16. facepalm
    `facepalm - one stubby hand covering the face over the eyes, other arm hanging, shoulders slumped, only the mouth visible: a flat line. Head tilted down. Front view. No props.`
    Talk: flat line opens into a small flat oval.
17. counting_money
    `counting_money - both hands holding a small fan of three paper banknotes (plain rectangles with a simple oval in the centre, no numbers, no currency symbols, no text), eyes wide looking at the notes, eyebrows raised, mouth a small open smile. Body slightly forward, three-quarter view. Notes use ink and off-white only, never the accent colour.`
    Talk: smile opens into a small oval.
18. holding_sign
    `holding_sign - both hands holding a blank rectangular signboard in front of the chest, held up at an angle (blank, no text, no marks, plain off-white with ink outline), eyebrows slightly raised, mouth a neutral small smile. Front view. The sign is a separate shape so it can be filled later.`
    Talk: mouth open mid-word.
19. reading
    `reading - both hands holding a small open book (blank pages, ink outline, no text) at belly height, eyes looking down at the book, eyebrows slightly raised, mouth a small flat line. Slight head tilt down. Front view. No other props.`
    Talk: flat line opens into a small oval.
20. writing
    `writing - one hand holding a pencil (simple outlined stick) touching a small blank notepad held by the other hand, eyes looking down at the pad, eyebrows level, mouth a small concentrated line. Body three-quarter view. No text on the pad.`
    Talk: mouth a small open oval.

Notes for all poses: keep tie/scarf/cap the exact same shape and size in every pose. The accent region never gets any extra colour. Props use only ink and off-white.

## 4. Consistency checklist and drift fix
After each pose, compare with the sheet:
- [ ] Body is egg-shaped and the same width and height as the sheet (no growing between poses).
- [ ] Outline thickness equal to the sheet (not thicker or thinner, no sketchy double lines).
- [ ] Eyes: same size, same shape, same pupil size and position.
- [ ] The accent item: same shape, one flat colour, own outline, correct position.
- [ ] Off-white body is the same shade; no shading, gradients, texture blotches or shadows.
- [ ] Arms and legs are stubby, same length and thickness.
- [ ] Feet touch the bottom edge; whole character is in the frame; centred.
- [ ] Pure white background, no ground line, no text, no extra props, no watermark.
- [ ] Facing direction matches the prompt (explain_left vs explain_right are true mirrors in intent, not just flipped art if the accent asymmetry matters).
- [ ] The `_talk` frame is identical to the pose except the mouth.

Drift-fix prompt (attach the sheet AND the drifting image):
```
Redraw the second attached image so it matches the first attached image exactly.
The first image is the master character: copy its body proportions, eye size and
shape, line thickness, off-white colour, and the [ACCENT ITEM] shape and green
colour. Keep the pose, expression and camera angle of the second image
unchanged. Fix only: [what drifted: e.g. outline too thin / eyes too small / tie
too long / body too round]. Plain pure white background, no shadow, no text, full
body, feet on the bottom edge, 4:5 portrait.
```
If one pose keeps drifting, regenerate from the sheet instead of fixing the fix.

## 5. Order of generation and files
Pose frequency in `src/director/direct.ts` (POSE_BY_EMOTION, counted across candidate lists): explain_dir (resolves to explain_left or explain_right) appears in 2 emotions and neutral is the default, sweating 3, thinking 3, reading 2, thumbs_up 2, worried 2; everything else 1.

Generate in this order (first 6 cover most scenes):
1. neutral
2. explain_right
3. explain_left
4. thinking
5. sweating
6. worried

Then thumbs_up, reading, then the rest: smug, happy, shocked, excited, pointing_up, counting_money, writing, confused, angry, facepalm, sad, holding_sign.

The engine uses placeholders for missing poses, so the first 6 can ship alone.

Per pose:
1. Generate pose (prompt in section 3), then its `_talk` (one prompt). Save raw files outside the repo, e.g. `~/art/raw/worried.png`, `~/art/raw/worried_talk.png`.
2. Remove the background: remove.bg or `rembg i raw.png nobg.png`. Check edges on a dark and a light backdrop for white halos. The accent region must not be eaten by the matting.
3. Pad and place: `scripts/pad-pose.sh nobg.png assets/character/worried.png` (and the same for `worried_talk.png`). Output is 1200x1500 RGBA, bottom-aligned, centred. If scale drifts between poses, crop all raws to the same canvas first (see `docs/MASCOT-ART.md`).
4. Names: `assets/character/<pose>.png` and `<pose>_talk.png` with the exact pose names above (lowercase, underscores).
5. Run `npm run assets:check`; fix all ERRORs and review warnings. Lay all poses side by side and run the section 4 checklist.
6. Render a short episode and confirm the real art shows (and the accent recolour works).
