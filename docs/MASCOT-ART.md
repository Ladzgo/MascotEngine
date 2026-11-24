# Mascot art: spec, prompts, cleanup

The engine uses a placeholder mascot until real PNGs are in `assets/character/`. No code change is needed when they land.

## Files (20 poses, each with an optional `_talk` twin)
`neutral, explain_left, explain_right, pointing_up, thinking, happy, excited, thumbs_up, smug, worried, shocked, sweating, sad, angry, confused, facepalm, counting_money, holding_sign, reading, writing`

Save as `assets/character/<pose>.png` and `<pose>_talk.png` (same image, mouth open mid-word).

## File spec
- PNG with real transparency (RGBA, 8-bit, non-interlaced), 1200x1500 px
- Full body, centred horizontally (centre within 60 px of x=600)
- Baseline: lowest opaque pixel row on the bottom edge (within 20 px of row 1499), same baseline across all poses (median +/- 12 px)
- Optional `manifest.json` must be valid JSON

## Check: `npm run assets:check` (empty folder, run 2026-11-23)
```
> tsx src/pipeline/assetsCheck.ts
Checking /Users/laci/ytAutomation/assets/character
WARN missing poses (20): neutral, explain_left, explain_right, pointing_up, thinking, happy, excited, thumbs_up, smug, worried, shocked, sweating, sad, angry, confused, facepalm, counting_money, holding_sign, reading, writing
file                        size       alpha   base  cx    status
Summary: 0 files, 0 errors, 1 warnings
```
Exit code 0. Missing poses are only a warning. Exit is 1 only if a present file has errors (wrong size, no alpha, no transparent pixels, unreadable PNG, invalid manifest.json) or the folder is missing. Baseline, off-centre and median-drift problems are warnings. Optional argument: a different folder (`npm run assets:check -- <dir>`).

## Prompts (from the brief, Appendix A)
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

## Cleanup workflow
1. Pick one character sheet (step 1) and fix it as the reference.
2. Generate each pose (step 2), then its `_talk` frame. Keep raw files outside the repo (e.g. `~/art/raw/`).
3. Remove the background (remove.bg, or `rembg i raw.png nobg.png`). Check edges on a dark and a light backdrop for white halos.
4. Pad to 1200x1500, bottom-aligned:
   ```bash
   scripts/pad-pose.sh nobg.png assets/character/worried.png
   ```
   The script trims transparent margins, scales down to fit (never up), centres horizontally and sits the lowest opaque row on the bottom edge. Note: it trims per image, so a pose with raised arms keeps its feet on the baseline but scales by its own bounding box; if size drifts between poses, crop all raws to the same canvas first and use `magick in.png -background none -gravity south -extent 1200x1500 out.png`.
5. Run `npm run assets:check`; fix every ERROR and review warnings.
6. Lay all poses side by side and regenerate any that drift in tie, eye size or line thickness.
7. Extract a frame from an episode render and confirm the real art shows.
