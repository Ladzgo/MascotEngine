# Pre-publish checklist (finance videos)

Tick every box before uploading. Tone and wording rules live in `docs/VOICE.md`. This is educational content, never advice.

## Script and facts
- [ ] A human read the whole script and edited it (note who and when in `docs/DECISIONS.md` or the episode notes). Automation assembles; a person owns angle and wording.
- [ ] Every number on screen (`big_number`, `chart`, `compare`) matches the cited source; open each URL in `sources` and compare.
- [ ] Illustrative maths states its assumptions in the narration ("at three percent").
- [ ] Source names and dates are in the description (e.g. "BLS CPI, 2023").
- [ ] No banned phrases from VOICE.md: guarantees ("guaranteed", "risk-free", "will double"), advice ("you should buy", "I recommend"), hype ("shocking", "get rich"), pressure ("act now").
- [ ] No promised or implied returns; future rates only as "if" with a stated rate.
- [ ] Episode has its own angle and sourced numbers, not a re-skin of the last one (check `episodes/<id>/build/variety.md`).

## Disclaimer
- [ ] `disclaimer: true`; the end-card shows: "This video is for education only and is not financial advice. Do your own research or talk to a licensed professional. Numbers are sourced in the description."
- [ ] Description repeats the disclaimer.

## AI disclosure
- [ ] YouTube Studio, Details, "Altered content": answer Yes if the realistic-sounding synthetic voice could be mistaken for a real person; set it per YouTube's current wording. When unsure, disclose.
- [ ] Description includes "Voice is AI-generated."
- [ ] Music and any asset has a licence entry in `assets/LICENSES.md`.

## Title, thumbnail, metadata
- [ ] Title and thumbnail promise only what the video delivers: no fake numbers, no "secret", no fear bait, no returns claims.
- [ ] Thumbnail numbers appear in the video with the same value.
- [ ] Chapters/description match the final cut; Shorts link back to the full video and also carry the disclaimer wording.

## Final watch
- [ ] Watched the final MP4 end to end: audio clear over music (about -14 LUFS, `scripts/audio-check.sh`), captions correct, no clipped text, no mispronounced numbers.
- [ ] Cadence stays sustainable (the roadmap suggests 2-3 uploads per week at most); YouTube's inauthentic/mass-produced content policy targets repetitive, templated, unreviewed output, which this checklist is meant to prevent.
