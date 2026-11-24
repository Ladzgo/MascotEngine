# UX plan: Studio navigation, ergonomics, new functions

## Problems today
App.tsx is one component (routing, jobs, saving, rail). Active channel only in localStorage; scene/tab not in URL. Rail: episodes only as title+dots, no search/status. Script edited per scene in a side tab, no undo (autosave overwrites). Generate (header) and progress (footer) far apart; one in-memory job (409 on second); any edit re-runs whole stages; no notification when done. No publish record, no delete/archive, no search, no shortcuts, no breadcrumb.

## New IA
- Rail (slim): Today, Pipeline, Library, Ideas; footer: Channels, Settings. Top bar: channel scope chip (URL `?ch=`, `all` allowed), breadcrumb `Channel > Episode > Step`, Cmd/Ctrl+K field, jobs chip (running + queue, popover).
- Episode workspace with sticky stepper: Script > Voice > Visuals > Render > Publish (state per step: empty/ready/running/done/stale/failed; step primary action). One persistent player; selecting a scene seeks to its startSec.
- Command palette (Cmd/Ctrl+K): groups Episodes, Ideas, Channels, Scenes, Actions; prefixes `>` actions, `#` ideas, `@` channels. Esc closes, focus returns.
- Shortcuts: `g t/p/l/i/s` go; `?` sheet; `1..5` step; `[`/`]` or J/K scene; Cmd+Enter Generate; Cmd+Shift+Enter Preview; Cmd+Z/Shift+Z undo/redo; Cmd+D duplicate scene; Alt+Up/Down move scene. Disabled while typing except Cmd combos/Esc.
- URLs (hash router, no new dep): `#/today?ch=` `#/library?ch=&q=&status=` `#/pipeline?ch=` `#/ideas?ch=&f=` `#/channels[/id]` `#/settings` `#/queue` `#/ep/<id>/script|voice|visuals|render|publish?scene=&tab=`. Old `#/ep/<id>` redirects to next-needed step.

## Lanes (no shared files; each lane also appends one line to docs/DECISIONS.md at the end)
- N (nav shell): App.tsx (shell+router only), router.ts, Rail.tsx, TopBar.tsx, Palette.tsx, Shortcuts.tsx, Overview.tsx (-> Today), Library.tsx, Ideas.tsx, Channels.tsx, Settings.tsx, nav/global parts of styles.css (put new CSS in nav.css). Provides `useRoute()` -> {ch, ep, step, scene}, `setRoute()`, `registerActions(actions[])`. Owns api.ts, router.ts.
- W (episode workspace): Workspace.tsx, Stepper.tsx, ScriptEditor.tsx (continuous script + word/duration counters), ImportScript.tsx (paste -> scenes), Storyboard.tsx, Inspector.tsx, Player.tsx, Publish.tsx, StageTrack.tsx, ws.css, api-ws.ts. Features: scene->player sync, per-scene regenerate buttons (hide if endpoint 404), drag-reorder + keyboard Alt+Up/Down, duplicate scene, multi-select bulk actions, scene notes, undo/redo (client) + versions UI, cost note, duplicate/archive in episode menu.
- S (server data): studio/server.ts (may split into studio/server/*.ts), plus Pipeline.tsx, Calendar.tsx, Queue.tsx, Compare.tsx, Versions.tsx, api-data.ts, data.css. Order: status, versions, search, duplicate/archive/trash, queue (generate becomes a wrapper), pipeline, cost, calendar, compare.

## API contracts (JSON, errors `{error}`, existing HttpError style, ids validated)
```
GET  /api/search?q=&ch=            -> {episodes:[{id,title,channel,status}], ideas:[...], scenes:[{ep,n,text}]}
GET  /api/pipeline?ch=             -> {columns:{idea:[],script:[],voiced:[],rendered:[],published:[]}}
GET/PUT /api/episodes/:id/status   {state:'draft'|'scheduled'|'published', youtubeUrl?, publishedAt?, scheduledFor?}
GET  /api/episodes/:id/versions    -> [{id,at,scenes,titleChanged}]  (episodes/<id>/history/<ts>.json, max 50, debounced)
POST /api/episodes/:id/versions/:vid/restore -> {ok:true} (snapshots current first)
POST /api/episodes/:id/scenes/:n/regenerate {kind:'voice'|'preview', confirm?} -> 202 {jobId}
GET  /api/episodes/:id/cost        -> {chars,cachedChars,images,estUsd,budget?}
POST /api/queue {episode,stages,engine} -> 202 {jobId,position}; GET /api/queue; DELETE /api/queue/:jobId; SSE /api/queue/events
POST /api/episodes/:id/duplicate {id}; POST .../archive; DELETE /api/episodes/:id (moves to episodes/_trash/)
GET/PUT /api/episodes/:id/notes    {notes:{[sceneIndex]:string[]}} (sidecar notes.json)
```
`generate` keeps working (wrapper over queue). Browser Notification + tab-title badge when a job finishes/fails.

## Ergonomics rules
Focus to page h1 on route change and set document.title; palette/modals trap focus and restore it; roving tabindex in lists; every action has a shortcut hint and is in the palette; min 40px primary hit area, text >=12px; state in URL (ch, step, scene, filters, q); every empty state has one sentence + one button; disabled controls say why; destructive actions prefer undo toasts and state cost; reduced motion respected. Never call paid APIs in tests.
