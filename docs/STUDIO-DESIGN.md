# Studio design

## 1. Audit (2026-11-28, before the redesign)

Screens captured with `npm run smoke:ui` at 1280x860; copies in `out/studio-design/before/`.

### Cluttered
- **Episode pages carry two progress trackers.** The Script/Voice/Visuals/Render/Publish stepper at the top and the Voice/Direct/Preview/Final/Shorts stage track pinned at the bottom say the same thing twice. The bottom bar is always on screen, even when idle ("Idle."), and covers the last rows of the script and storyboard.
- **The top bar is overloaded.** Breadcrumb, channel select, search, Jobs chip and a second "New video" button compete in 64px. On episode pages the breadcrumb truncates ("Money Myt... / Sitting All Day: Hidden Co... / Scr...") and the search and New video labels wrap onto two lines.
- **Every Today card has a glowing primary button.** Six equal "Next: Voice" accent buttons; nothing is primary.
- **Settings is a wall.** Machine checks, absolute paths and file lists in one long column with no grouping.

### Misplaced
- **Page purpose lines are duplicated.** App shell prints "Every episode in one place..." above the title and the page prints "Every episode in Money Myths..." under it (Library, Pipeline, Calendar, Settings).
- **Library header actions float.** "Select" and "Import ZIP" sit in the middle of the header, unaligned with "New episode".
- **The channel scope lives in the top bar and the breadcrumb** at once; it is a workspace-level choice and belongs at the top of the sidebar.
- **The "EN -> HU" language toggle** is a big grey block in the sidebar footer, though the channel is English only. It belongs in Settings.
- **New video:** six idea suggestions push the format and voice choices (and the Make video button) far below the fold.

### Inconsistent
- **Two accents in one viewport.** The app chrome is violet; inside an episode the episode's teal replaces it, so the top-bar "New video" is violet and "Next: Voice" next to it is teal.
- **Three CSS layers fight** (`styles.css` paper/ink, `nav.css`, `skin.css` dark override plus `#root` specificity hacks). Leftovers show: hard offset shadows on popovers, dashed fieldsets, side-stripe toasts, glow halos under primary buttons.
- **Monospace as costume.** Counts, durations, the Jobs label and the save state are set in IBM Plex Mono.
- **Heights and paddings drift:** buttons 32/40/44px, panels 14/16/18/20px padding, h1 24px on some pages and 30px on others.
- **Pipeline board scrolls sideways** at 1280px (the Published column is cut off). The storyboard strip scrolls sideways too, with checkboxes overlapping card titles.
- **Dark only.** No light theme, no system preference.

## 2. Direction

Mode: Operate. A solo creator at a desk, one episode at a time, for long sessions. The craft bar is Linear, Descript and the CapCut desktop app: the tool disappears into the task.

- **One family, one accent.** Inter for everything (tabular numerals for data); monospace only for code and logs. One cobalt UI accent for primary actions, focus and selection. The episode's own colour is shown as an identity swatch next to its title (`--ep`), never as a second button colour.
- **Neutral greys with a faint cool tint**, a second neutral layer for the sidebar. Light and dark, following the system by default, switchable from the sidebar (stored per browser).
- **State colours mean state only:** green done, red failed, amber out of date.
- **Flow first.** The primary path, idea -> script -> voice/visuals -> render -> publish, is the episode stepper at the top of every episode page, with the step's one primary action at its right end. The live pipeline status appears under the content only while a job runs or has just ended.

## 3. Tokens

All in `studio/web/src/styles.css` (`:root`, `[data-theme]`).

| Token | Use |
|---|---|
| `--bg`, `--bg-2`, `--bg-3`, `--raise` | page, sidebar/panel, inset/hover, raised control |
| `--text`, `--text-2`, `--muted` | primary, secondary, tertiary text (all AA on their grounds) |
| `--line`, `--line-2` | hairline, control border |
| `--accent`, `--on-accent`, `--accent-soft` | primary action, its label, selected tint |
| `--ok`, `--err`, `--warn` | done, failed, out of date |
| `--ep` | the open episode's identity colour (swatch only) |
| `--s1..--s6` | 4 / 8 / 12 / 16 / 24 / 32 px spacing |
| `--r1..--r3` | 6 / 8 / 12 px radius |
| `--t-xs..--t-xl` | 12 / 13 / 14 / 16 / 20 / 24 px type |

Controls: 32px default height, 28px small, 40px large. Focus: 2px accent ring, 2px offset.

Old names (`--paper`, `--ink`, `--field` ...) stay as aliases so page sheets and inline styles keep working.

## 4. Layout

- **Sidebar** (`Rail.tsx`): brand, channel picker (moved from the top bar), the one global "New video" button, nav in flow order (Today, Ideas, Pipeline, Library, Clipper, Analytics), footer with Channels, Settings and the theme switch (system -> light -> dark).
- **Top bar** (`TopBar.tsx`): breadcrumb (the current page never truncates first), search/command palette, Jobs chip. Nothing else.
- **Pages**: `page-head` = h1 + one muted line on the left, actions on the right (`page-actions`). Lists (Today, Library) are one bordered list with row dividers, not a stack of cards. Only one primary button per view.
- **Episode** (`Workspace.tsx`, `ws.css`): title row (episode swatch, title, save state, cost, Undo/Redo, Episode menu) -> sticky stepper with the step's primary action -> content + 360px inspector. The live pipeline status (`StageTrack`) floats at the bottom only while a job for this episode exists.
- **New video**: the Make step sticks to the bottom of the viewport, so the primary action is always in reach.
- **No sideways scroll**: Pipeline columns wrap, storyboard cards wrap (width still follows scene duration), long chips wrap. `npm run smoke:ui` fails if any page scrolls sideways at 1280px or 390px.

## 5. Verify

`npm run smoke:ui` walks every route and the main path, then captures dark (`dark-*.png`) and phone (`phone-*.png`) screenshots into `out/smoke-ui/`. Before/after sets: `out/studio-design/before/`, `out/studio-design/after/`.

Not in this lane, now stale: the root `DESIGN.md` and `.impeccable/surfaces/studio-web-index-html.md` still describe the old paper-and-ink direction. This file supersedes them for the Studio.
