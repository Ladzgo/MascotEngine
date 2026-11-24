# Security review of `studio/server.ts` (read-only review; fixes are for the server.ts owner)

Scope: every `/api/*` route, file access, uploads, process spawning, network binding. Reviewed against the current `main`. The Studio is a local tool (no accounts), so the realistic attacker is **a web page the user visits in another tab** or another user on the same machine, not the open internet.

## What is already fine

- Binds to `127.0.0.1` only (`server.listen(PORT, '127.0.0.1')`), not reachable from the LAN.
- Episode ids go through `epDir()` with `ID_RE = /^[a-z0-9-]+$/` (no `/`, no `..`); channel ids through `channelDir()` with the same regex; clip names/files through `clipSafe()` (`[A-Za-z0-9._-]`, no leading dot, so no `..`).
- Media routes use `path.basename()` on the file name; version ids are `^\d{13}$`; scene numbers are `^\d+$` and range-checked; audio `ext` is checked against a whitelist.
- JSON bodies are capped at 5 MB, audio uploads at 50 MB (`readRaw`).
- Child processes use `spawn(cmd, argsArray)` without a shell, so no command injection through topic, angle or ids.

## Findings

| # | Severity | Finding | Proposed fix |
|---|---|---|---|
| 1 | High | **Cross-site request forgery.** `body()` parses JSON regardless of `Content-Type`, and no route checks `Origin`. Any website can `fetch('http://localhost:4177/api/make', {method: 'POST', mode: 'no-cors', body: '{"topic":"..."}'})` (a "simple" request, no preflight) and start jobs, delete episodes, change channels or settings. | In the `http.createServer` callback, for every non-GET/HEAD `/api/` request require `Origin` to be absent or equal to `http://localhost:PORT` / `http://127.0.0.1:PORT`, and require `Content-Type: application/json` (or the audio/video types on the raw upload routes) so cross-site simple requests are rejected. |
| 2 | High | **DNS rebinding.** The `Host` header is never validated (`new URL(req.url, 'http://' + req.headers.host)`). A rebinding page can make the browser treat `evil.example` as `127.0.0.1:4177` and read every GET response (scripts, ideas, settings, media). | Reject any request whose `Host` is not `localhost:PORT`, `127.0.0.1:PORT` or `[::1]:PORT` with 403. Same check protects the Vite dev middleware. |
| 3 | Medium | **Unbounded upload.** `POST /api/clips/upload` pipes the request straight into `data/uploads/<name>` with no size limit (disk fill) and silently overwrites an existing file of that name. | Count bytes in a `data` listener, abort with 413 and delete the partial file past a limit (e.g. 10 GB), write to `<name>.part` and `rename` on success; refuse an existing name unless `?replace=1`. |
| 4 | Medium | **Arbitrary local video path.** `POST /api/clip {path}` accepts any absolute path to an mp4/mov/mkv/webm/m4v on the machine and processes it; combined with #1 a web page could make the Studio read and re-encode private videos into `out/clips/` (served at `/api/clips/<name>/<file>.mp4`). | Only accept `upload` names, or restrict `path` to a configured media directory (resolve with `fs.realpathSync` and check it starts with the allowed root). |
| 5 | Low | **State change on GET.** `GET /api/episodes/<id>/media/<id>.vtt` writes `build/*.vtt/srt` (exportSubtitles). Harmless locally, but GET should be side-effect free. | Export in the render step, or make the route POST. |
| 6 | Low | **Argument injection through the topic.** `topic` is passed as a positional to `npm run draft -- <topic>`; a topic starting with `-` (e.g. `--id`) is parsed as an option by `parseArgs` and the run fails or behaves oddly (no shell, so no command execution). | Reject topics starting with `-`, or pass `--` before the positional (the draft CLI would need `positionals` after `--`); simplest: strip leading dashes. |
| 7 | Low | **Error detail leak.** `friendlyError` / `cliMessage` return the last CLI log line, which can include absolute file paths. | Fine for a local tool; keep, but do not expose the Studio beyond localhost. |
| 8 | Info | **Static file serving via Vite middleware** is the dev server (`middlewareMode`); its `server.fs.strict` default (true) restricts reads to the workspace. Keep it; do not set `server.fs.strict: false` or `server.host`. | none |
| 9 | Info | **Secrets**: `.env` is git-ignored, `/api/settings` should never echo keys back in full. Verify that GET returns masked values (`sk-...abcd`) if keys are shown. | check |

## Suggested patch (findings 1 and 2, about 15 lines)

```ts
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
const server = http.createServer((req, res) => {
  if (!ALLOWED_HOSTS.has(req.headers.host ?? '')) { res.writeHead(403); return void res.end('Bad host'); }
  if (req.url?.startsWith('/api/') && !['GET', 'HEAD'].includes(req.method ?? 'GET')) {
    const origin = req.headers.origin;
    if (origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, ''))) { res.writeHead(403); return void res.end('Bad origin'); }
    const ct = req.headers['content-type'] ?? '';
    const raw = /\/(audio\/\d+|clips\/upload)/.test(req.url); // raw binary routes
    if (!raw && req.headers['content-length'] !== '0' && !ct.startsWith('application/json')) { res.writeHead(415); return void res.end('JSON only'); }
  }
  // ...existing routing
});
```
The web client already sends JSON with `Content-Type: application/json` (check `studio/web/src/api*.ts`: fetch calls without a body, such as DELETE or queue actions, must keep working, hence the `content-length` exception).

## Not reviewed

Dependencies (`npm audit` needs internet), the Vite/React client beyond one grep: no `dangerouslySetInnerHTML` in `studio/web/src` (React escapes text by default), the Remotion render sandbox.
