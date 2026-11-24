# UI findings (CSS side, for the owner of studio/web/src/*.css)

Click-through on localhost:4177 (desktop width; the browser tool could not shrink the window, so phone width was not checked). No console errors on Library, Queue, Pipeline, Analytics, Settings, Calendar.

1. **Library "Out of date" label is green.** Cause was the TSX using the `rendered` class; it now emits `.status.stale`. Needs CSS (mustard, same as `.status.scheduled`):
   `.status.stale { background: rgba(236,191,85,.18); color: var(--warn); }`
2. **Publish player is small.** Give the video column more room: `.player { width: min(100%, 720px); }` (9:16 Short: `max-height: 70vh`).
3. **Language toggle in the rail (new `button.nav-link`) renders as a solid grey block.** Browser default button styling leaks: add
   `button.nav-link { background: none; border: 0; width: 100%; text-align: left; cursor: pointer; font: inherit; }`
4. **Pages hug the left edge on wide screens** (`.page { max-width: 1100px }`, no centering; large dead area on the right at 1500 px). Suggest `.page { margin-inline: auto; }` or a wider `max-width: 1280px` for Library/Pipeline.
5. **Density**: Library rows are tight but readable; the stage dots (`.lib-stages i`) are very small. Use `width/height: 10px` and `gap: 4px`.
6. **Contrast**: muted text `--muted: #8b919b` on `--paper: #0a0b0d` is about 6:1 (fine); on `--paper-3: #181a1e` (chips, Pipeline cards) about 5:1. Raise to `#9aa0aa` for small (12 px) text on cards.
7. **Calendar**: day cells are empty-looking and the conflict marker "!" inherits `--ink`; colour it: `.d-num b { color: var(--err); }`. Today cell outline is good.
8. **Settings** panel is 560 px wide but contains the long readiness list; two columns for the list (`.ready ul { columns: 2 }` above 900 px) would shorten the page.
9. **Loading skeletons need CSS** (`Loading.tsx` emits the classes, no style yet):
   `.skeleton { background: var(--paper-3); border-radius: 6px; animation: sk 1.2s ease-in-out infinite alternate; } .sk-title { height: 28px; width: 40%; margin: 12px 0; } .sk-row { height: 48px; margin: 8px 0; } @keyframes sk { to { opacity: .45 } } @media (prefers-reduced-motion: reduce) { .skeleton { animation: none } }`. While unstyled the placeholder shows only the "Loading…" text (the bars are empty divs).

Phone width (390 px, checked via same-origin iframes, no horizontal page scroll anywhere; no JS errors on any route):
10. **Pipeline board**: `.d-col` sections extend past 390 px (the board needs its own horizontal scroll: `.d-board { overflow-x: auto; scroll-snap-type: x mandatory }`, columns `min-width: 78vw`).
11. **Episode stepper** (`.stp`, `.stp-l`) overflows at 390 px: make the stepper `overflow-x: auto` or hide the labels (`.stp-l { display: none }` below 520 px, keep the numbers).
