try { process.loadEnvFile(); } catch { /* .env optional */ }
import {sceneWords, toVtt} from '../src/publish/subtitles.js';
import {buildPhrases} from '../src/fx/captions.js';
import {scheduleRows, toCsv} from '../src/publish/scheduleExport.js';
import {summarize} from '../src/analytics/summary.js';
import {checkReadiness} from '../src/doctor/doctor.js';
import {checkRequest, underRoots} from '../src/guard.js';
import {exportEpisodeZip, importEpisodeZip} from './archive.js';
import {logLine} from '../src/support/log.js';
import {friendlyError} from '../src/errors.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer as createVite} from 'vite';
import {deletePreset, listPresets, savePreset} from '../src/channel/userPresets.js';
import react from '@vitejs/plugin-react';
import {z} from 'zod';
import {Episode} from '../src/schema.js';
import {voiceEngines, previewVoice} from '../src/pipeline/voicePreview.js';
import {VoicePreviewBody, ArchiveBody, ClipStartBody, DuplicateBody, IdeaStatusBody, NewEpisodeBody, NotesBody, QueueBody, RegenerateBody, SettingsBody, LlmProviderBody, StockKeyBody, ThumbBody, ChannelBody, DraftBody, GenerateBody, IdeasGenerateBody, MakeBody, parseBody, PresetBody, StatusBody} from './schemas.js';
import {testPixabayKey} from '../src/stock/providers.js';
import {ensureOllama, llmSetupState, ollamaReachable, pickModel, testProvider} from '../src/llm/llm.js';

const ROOT = new URL('../', import.meta.url).pathname;
const EPISODES = `${ROOT}episodes/`;
const CHANNELS = `${ROOT}channels/`;
const PORT = Number(process.env.STUDIO_PORT ?? 4177);
const ID_RE = /^[a-z0-9-]+$/;

// ---------- helpers ----------
class HttpError extends Error { constructor(public code: number, msg: string) { super(msg); } }
const json = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(body));
};
const readBody = (req: http.IncomingMessage) => new Promise<string>((ok, bad) => {
  let s = '', over = false;
  req.on('data', c => { if (over) return; s += c; if (s.length > 5e6) { over = true; bad(new HttpError(413, 'Request body too large.')); req.resume(); } });
  req.on('end', () => { if (!over) ok(s); }); req.on('error', bad);
});
const body = async <S extends z.ZodType = z.ZodType<Record<string, unknown>>>(req: http.IncomingMessage, schema?: S): Promise<z.infer<S>> => {
  let v: unknown;
  try { v = JSON.parse(await readBody(req)); if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object'); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Request body is not valid JSON.'); }
  if (!schema) return v as z.infer<S>;
  try { return parseBody(v, schema); } catch (e) { throw new HttpError(400, (e as Error).message); }
};
const AUDIO_EXT: Record<string, string> = {wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4'};
const MAX_AUDIO = 50 * 1024 * 1024;
const readRaw = (req: http.IncomingMessage, max: number) => new Promise<Buffer>((ok, bad) => {
  const parts: Buffer[] = []; let n = 0, over = false;
  req.on('data', (c: Buffer) => { if (over) return; n += c.length; if (n > max) { over = true; bad(new HttpError(413, `File too large (max ${max / 1024 / 1024} MB).`)); req.resume(); return; } parts.push(c); });
  req.on('end', () => { if (!over) ok(Buffer.concat(parts)); }); req.on('error', bad);
});
const sceneCount = (d: string) => readJson<{scenes?: unknown[]}>(`${d}episode.json`)?.scenes?.length ?? 0;
const sceneAudio = (d: string, n: number) => {
  for (const ext of Object.keys(AUDIO_EXT)) { const f = `${d}audio/scene-${n}.${ext}`; try { const st = fs.statSync(f); if (st.isFile()) return {file: `scene-${n}.${ext}`, size: st.size, source: fs.existsSync(`${f}.json`) ? 'generated' as const : 'recording' as const}; } catch { /* none */ } }
  return null;
};
const rmSceneAudio = (d: string, n: number) => { for (const e of Object.keys(AUDIO_EXT)) { fs.rmSync(`${d}audio/scene-${n}.${e}`, {force: true}); fs.rmSync(`${d}audio/scene-${n}.${e}.json`, {force: true}); } };
const requireGeneratedConfirm = (d: string, n: number, url: URL, verb: string) => {
  if (sceneAudio(d, n)?.source === 'generated' && url.searchParams.get('confirm') !== 'generated') throw new HttpError(409, `${verb} this scene's audio deletes paid ElevenLabs generated audio. Repeat with ?confirm=generated to proceed.`);
};
const readJson = <T,>(file: string): T | null => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const epDir = (id: unknown) => { if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, 'Invalid episode id.'); return `${EPISODES}${id}/`; };

function episodeSummary(id: string) {
  const d = epDir(id), b = `${d}build/`;
  const ep = readJson<{title?: string; channel?: string; scenes?: unknown[]}>(`${d}episode.json`);
  const dec = readJson<{accent?: string; totalSec?: number}>(`${b}decisions.json`);
  const has = (f: string) => fs.existsSync(`${b}${f}`);
  const shortsDir = `${b}shorts/`;
  const mt = (f: string) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
  const input = Math.max(mt(`${d}episode.json`), mt(`${b}decisions.json`), mt(`${b}timings.json`));
  const stale = {preview: has(`${id}-preview.mp4`) && mt(`${b}${id}-preview.mp4`) < input, final: has(`${id}-final.mp4`) && mt(`${b}${id}-final.mp4`) < input};
  return {
    stale, status: readStatus(id),
    id, channel: ep?.channel ?? 'default', title: ep?.title ?? id, scenes: ep?.scenes?.length ?? 0,
    accent: dec?.accent ?? null, totalSec: dec?.totalSec ?? null,
    stages: {
      voice: has('timings.json'), direct: has('decisions.json'),
      preview: has(`${id}-preview.mp4`), final: has(`${id}-final.mp4`),
      shorts: fs.existsSync(shortsDir) ? fs.readdirSync(shortsDir).filter(f => f.endsWith('.mp4')).length : 0,
    },
  };
}

// ---------- jobs (one pipeline run at a time) ----------
type Stage = 'voice' | 'direct' | 'preview' | 'final' | 'shorts';
type Job = {id: string; episode: string; stages: Stage[]; current: Stage | null; done: Stage[]; log: string[]; status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'; engine: string; createdAt: number; error?: string; progress: number; clients: Set<http.ServerResponse>; child?: ReturnType<typeof spawn>};
const jobs = new Map<string, Job>();
// Jobs survive a Studio restart: a run that was mid-flight becomes an error with a Retry button, queued runs resume.
const JOBS_FILE = process.env.STUDIO_JOBS_FILE ?? `${ROOT}data/jobs.json`;
let jobsTimer: ReturnType<typeof setTimeout> | undefined;
const persistJobs = () => { jobsTimer ??= setTimeout(() => { jobsTimer = undefined; try { fs.mkdirSync(`${ROOT}data`, {recursive: true}); fs.writeFileSync(JOBS_FILE, JSON.stringify([...jobs.values()].slice(-40).map(({clients, child, ...j}) => ({...j, log: j.log.slice(-200)})))); } catch { /* best effort */ } }, 500); };
function loadJobs() {
  const saved = (() => { try { return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')) as Omit<Job, 'clients'>[]; } catch { return []; } })();
  for (const j of saved) {
    if (j.status === 'running') { j.status = 'error'; j.current = null; j.error = 'Interrupted: the Studio restarted during this run. Press Retry.'; }
    jobs.set(j.id, {...j, clients: new Set()});
  }
}

const STAGE_CMD: Record<Stage, (id: string, o: {engine: string; final: boolean}) => string[]> = {
  voice: (id, o) => ['tts', id, '--engine', o.engine],
  direct: (id, o) => ['direct', id, ...(o.final ? ['--final'] : [])], // --final records the episode in data/history.json
  preview: id => ['render', id, '--preview'],
  final: id => ['render', id, '--final'],
  shorts: id => ['shorts', id],
};

function emit(job: Job) {
  const payload = `data: ${JSON.stringify({id: job.id, episode: job.episode, status: job.status, current: job.current, done: job.done, stages: job.stages, progress: job.progress, error: job.error, log: job.log.slice(-60)})}\n\n`;
  for (const c of job.clients) c.write(payload);
  persistJobs(); broadcastQueue();
}

// ---------- readiness (src/doctor/doctor.ts) ----------
const readiness = () => checkReadiness();

// ---------- clipper (long video -> 9:16 clips; docs/CLIPPER.md) ----------
const VIDEO_RE = /\.(mp4|mov|mkv|webm|m4v)$/i;
const CLIP_OUT = `${ROOT}out/clips/`;
let clipJob: {status: 'idle' | 'running' | 'done' | 'error'; name?: string; log: string[]; error?: string} = {status: 'idle', log: []};
const clipSafe = (n: unknown) => typeof n === 'string' && /^[A-Za-z0-9._-]+$/.test(n) && !n.startsWith('.') ? n : null;
function listClips() {
  if (!fs.existsSync(CLIP_OUT)) return [];
  return fs.readdirSync(CLIP_OUT).flatMap(name => {
    const tl = readJson<{source?: string; clips?: {id: string; start: number; end: number; score: number; reasons: string[]; text: string; file?: string}[]}>(`${CLIP_OUT}${name}/timeline.json`);
    if (!tl?.clips) return [];
    return [{name, source: tl.source ?? '', clips: tl.clips.map(c => ({id: c.id, start: c.start, end: c.end, score: c.score, reasons: c.reasons, text: c.text, video: c.file && fs.existsSync(c.file) ? path.basename(c.file) : null}))}];
  });
}

// ---------- queue (one job runs, the rest wait) ----------
const queueClients = new Set<http.ServerResponse>();
const jobBrief = (j: Job) => ({jobId: j.id, episode: j.episode, stages: j.stages, status: j.status, current: j.current, done: j.done, progress: j.progress, error: j.error, engine: j.engine, createdAt: j.createdAt, log: j.status === 'error' ? j.log.slice(-40) : undefined, step: j.current ? `${j.done.length + 1}/${j.stages.length}` : undefined});
function queueState() {
  const all = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  return {
    running: all.find(j => j.status === 'running') ? jobBrief(all.find(j => j.status === 'running')!) : null,
    queued: all.filter(j => j.status === 'queued').map((j, i) => ({...jobBrief(j), position: i + 1})),
    recent: all.filter(j => j.status === 'done' || j.status === 'error' || j.status === 'cancelled').slice(-10).reverse().map(jobBrief),
  };
}
function broadcastQueue() { if (!queueClients.size) return; const payload = `data: ${JSON.stringify(queueState())}\n\n`; for (const c of queueClients) c.write(payload); }
function pump() {
  if ([...jobs.values()].some(j => j.status === 'running')) return;
  const next = [...jobs.values()].filter(j => j.status === 'queued').sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!next) { broadcastQueue(); return; }
  next.status = 'running';
  void runJob(next, next.engine).catch(e => { next.status = 'error'; next.error = friendlyError(String(e)); emit(next); }).finally(pump);
}
/** Validate a generate/queue request and add the job. Throws HttpError. */
function enqueue(id: string, b: {stages?: unknown; engine?: unknown}) {
  const d = epDir(id);
  if (!fs.existsSync(`${d}episode.json`)) throw new HttpError(404, 'Episode not found.');
  if (!Array.isArray(b.stages) || !b.stages.length || !b.stages.every(x => typeof x === 'string' && x in STAGE_CMD)) throw new HttpError(400, 'stages must be a non-empty list of: voice, direct, preview, final, shorts.');
  const stages = b.stages as Stage[];
  // rate limit: bounded queue, and no second identical run for the same episode while one is waiting
  const active = [...jobs.values()].filter(j => j.status === 'queued' || j.status === 'running');
  if (active.length >= 20) throw new HttpError(429, 'Too many runs are waiting (20). Wait for some to finish or remove them in the Queue.');
  if (active.some(j => j.status === 'queued' && j.episode === id && j.stages.join() === stages.join())) throw new HttpError(409, 'The same run is already waiting for this episode.');
  const engine = String(b.engine ?? 'auto');
  if (!['auto', 'say', 'espeak-ng', 'piper', 'kokoro', 'edge', 'eleven', 'local', 'silent'].includes(engine)) throw new HttpError(400, 'engine must be auto, say, kokoro, piper, edge, espeak-ng, eleven, local or silent.');
  if (stages.includes('voice') && engine === 'eleven' && (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID)) throw new HttpError(422, 'ElevenLabs key or voice ID is missing. Add them in Settings.');
  if (stages.includes('voice') && engine === 'local') {
    const miss = Array.from({length: sceneCount(d)}, (_, i) => i + 1).filter(n => !sceneAudio(d, n));
    if (miss.length) throw new HttpError(422, `Own-voice engine needs a recording for every scene. Missing: scene ${miss.join(', ')}.`);
  }
  const job: Job = {id: randomUUID(), episode: id, stages, current: null, done: [], log: [], status: 'queued', engine, createdAt: Date.now(), progress: 0, clients: new Set()};
  jobs.set(job.id, job);
  pump(); broadcastQueue();
  return {jobId: job.id, position: job.status === 'queued' ? [...jobs.values()].filter(j => j.status === 'queued').indexOf(job) + 1 : 0};
}

async function runJob(job: Job, engine: string) {
  for (const stage of job.stages) {
    if (job.status === 'cancelled') return;
    job.current = stage; job.progress = 0; emit(job);
    const args = STAGE_CMD[stage](job.episode, {engine, final: job.stages.includes('final')});
    await new Promise<void>(ok => {
      const child = process.env.STUDIO_TEST_FAKE_JOBS // tests: a sleeping stand-in, never a real tts/render
        ? spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'])
        : spawn(path.join(ROOT, 'node_modules/.bin/tsx'), [`${ROOT}src/pipeline/cli.ts`, ...args], {cwd: ROOT, env: process.env});
      job.child = child;
      const onData = (buf: Buffer) => {
        for (const line of buf.toString().split('\n').filter(Boolean)) {
          job.log.push(line);
          const m = line.match(/render (\d+)%/);
          if (m) job.progress = Number(m[1]) / 100;
        }
        emit(job);
      };
      child.stdout.on('data', onData); child.stderr.on('data', onData);
      child.on('close', code => {
        if (job.status === 'cancelled') return ok();
        if (code !== 0) { job.status = 'error'; const last = job.log.filter(l => !l.startsWith('render ')).slice(-1)[0] ?? `exit ${code}`; job.error = `${stage} failed: ${/ENOENT.*episode\.json/.test(last) ? 'episode.json is missing for this episode' : friendlyError(job.log.slice(-12).join('\n')) !== job.log.slice(-12).join('\n') ? friendlyError(job.log.slice(-12).join('\n')) : last}`; }
        else job.done.push(stage);
        if (job.status === 'error') logLine(ROOT, 'job-failed', `${job.episode} ${stage}: ${job.error}`);
        ok();
      });
    });
    if (job.status === 'error') { emit(job); return; }
  }
  if (job.status !== 'running') { job.current = null; job.child = undefined; emit(job); return; }
  job.status = 'done'; job.current = null; job.progress = 1; emit(job);
}

// ---------- settings (.env) ----------
const ENV_FILE = `${ROOT}.env`;
function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(ENV_FILE)) return out;
  for (const l of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) out[m[1]] = m[2]; }
  return out;
}
function writeEnv(upd: Record<string, string>) {
  const cur = readEnv(); Object.assign(cur, Object.fromEntries(Object.entries(upd).map(([k, v]) => [k, v.replace(/[\r\n]+/g, '')])));
  fs.writeFileSync(ENV_FILE, Object.entries(cur).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  for (const [k, v] of Object.entries(upd)) process.env[k] = v;
}

// ---------- drafter (npm run draft) ----------
const draftInstalled = () => !!readJson<{scripts?: Record<string, string>}>(`${ROOT}package.json`)?.scripts?.draft;
const nextId = (topic: string) => {
  const n = Math.max(0, ...fs.readdirSync(EPISODES).map(d => Number(d.match(/^ep(\d+)/)?.[1] ?? 0))) + 1;
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 4).join('-');
  return `ep${String(n).padStart(3, '0')}${slug ? '-' + slug : ''}`;
};
function runNpm(args: string[], onLine?: (l: string) => void, env: Record<string, string> = {}) {
  return new Promise<{code: number | null; out: string[]}>(ok => {
    const child = spawn('npm', ['run', ...args], {cwd: ROOT, env: {...process.env, ...env}});
    const out: string[] = [];
    const onData = (b: Buffer) => { const ls = b.toString().split('\n').filter(l => l.trim()); out.push(...ls); ls.forEach(l => onLine?.(l)); };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.on('error', e => ok({code: 1, out: [e.message]}));
    child.on('close', code => ok({code, out}));
  });
}
/** Section progress of the running draft (DRAFT_PROGRESS lines from the CLI), polled by the Studio. */
let draftProgress: {done: number; total: number; label: string} | null = null;
const runDraft = (topic: string, id: string, angle: string, channel: string, short = false, model = '', device = '', onProgress?: (p: {done: number; total: number; label: string}) => void) => {
  draftProgress = {done: 0, total: 0, label: 'Planning the outline'};
  if (process.env.STUDIO_TEST_FAKE_JOBS) return (async () => { // tests: no LLM, instant episode (topic "fail" errors)
    for (let k = 1; k <= 2; k++) { onProgress?.({done: k, total: 2, label: `part ${k}`}); await new Promise(r => setTimeout(r, 150)); }
    if (/fail/.test(topic)) return {code: 1, out: ['Draft failed: outline failed after 3 tries']};
    fs.mkdirSync(`${EPISODES}${id}`, {recursive: true});
    fs.writeFileSync(`${EPISODES}${id}/episode.json`, JSON.stringify({id, title: topic, series: 's', seed: 0, scenes: [{type: 'talk', emotion: 'explaining', narration: 'Hello there.', emphasis: []}], sources: [], disclaimer: true}));
    return {code: 0, out: [`DRAFT_OK ${EPISODES}${id}/episode.json`]};
  })().finally(() => { draftProgress = null; });
  return runNpm(['draft', '--', topic, '--id', id, '--channel', channel, ...(angle ? ['--angle', angle] : []), ...(short ? ['--short'] : []), ...(device && /^[a-z_]+$/.test(device) ? ['--device', device] : [])], l => {
    const m = /^DRAFT_PROGRESS (\d+)\/(\d+) (.*)$/.exec(l);
    if (m) { draftProgress = {done: +m[1], total: +m[2], label: m[3]}; onProgress?.(draftProgress); }
  }, model ? {OLLAMA_MODEL: model, DRAFT_MODEL: model} : {}).finally(() => { draftProgress = null; });
};
/** Background drafts: the HTTP call returns at once, the browser polls GET /api/drafts/:id (progress, errors, and the render run that follows a "make"). */
type DraftJob = {id: string; state: 'running' | 'done' | 'error'; progress: {done: number; total: number; label: string}; error?: string; jobId?: string; startedAt: number; topic: string};
const drafts = new Map<string, DraftJob>();
function startDraft(o: {device?: string; topic: string; angle: string; channel: string; short: boolean; model?: string; ideaId?: string; make?: {stages: Stage[]; engine: string}}) {
  needAi('draft');
  const id = nextId(o.topic);
  if (!ID_RE.test(id)) throw new HttpError(400, 'Invalid episode id.');
  if (fs.existsSync(epDir(id)) || drafts.get(id)?.state === 'running') throw new HttpError(409, `Episode ${id} already exists.`);
  const release = lockAi();
  const job: DraftJob = {id, state: 'running', progress: {done: 0, total: 0, label: 'Planning the outline'}, startedAt: Date.now(), topic: o.topic};
  drafts.set(id, job);
  void (async () => {
    try {
      const {code, out} = await runDraft(o.topic, id, o.angle, o.channel, o.short, o.model, o.device, p => { job.progress = p; });
      if (!(code === 0 && out.some(l => l.startsWith('DRAFT_OK')) && fs.existsSync(`${EPISODES}${id}/episode.json`))) throw new Error(cliMessage(out, code));
      if (o.ideaId) { const f = readIdeas(o.channel), idea = f.ideas.find(i => i.id === o.ideaId); if (idea) { idea.status = 'drafted'; idea.episodeId = id; writeIdeas(o.channel, f); } }
      if (o.make) job.jobId = enqueue(id, {stages: o.make.stages, engine: o.make.engine}).jobId;
      job.state = 'done';
    } catch (e) { job.state = 'error'; job.error = (e as Error).message || 'The draft failed.'; }
    finally { release(); }
  })();
  return job;
}
const scriptInstalled = (name: string) => !!readJson<{scripts?: Record<string, string>}>(`${ROOT}package.json`)?.scripts?.[name];
const cliMessage = (out: string[], code: number | null) => friendlyError(out.filter(l => !l.startsWith('>') && !/^npm (warn|notice)/.test(l)).slice(-6).join('\n')) || `Command failed (exit ${code}).`;
/** One AI command at a time (draft, ideas, publish pack). Returns a release function. */
let aiBusy = false;
const lockAi = () => { if (aiBusy) throw new HttpError(409, 'Another AI task is already running. Wait for it to finish.'); aiBusy = true; return () => { aiBusy = false; }; };
const needAi = (script: string) => {
  if (!scriptInstalled(script)) throw new HttpError(501, `npm run ${script} is not installed yet. The command line side is still being built.`);
};

// ---------- channels ----------
type Channel = {id: string; name: string; description: string; niche: string; audience: string; tone: string; language: string; voiceId?: string; bannedTopics: string[]; postingPerWeek: number; createdAt: string; accent?: string; sayVoice?: string; voiceStyle?: string; branding?: {handle?: string; cta?: string; outroSec: number; watermark: boolean}};
const chDir = (id: unknown) => { if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, 'Invalid channel id. Use lowercase letters, numbers and dashes only.'); return `${CHANNELS}${id}/`; };
function ensureDefaultChannel() {
  const dir = `${CHANNELS}default/`;
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, {recursive: true});
  const c: Channel = {id: 'default', name: 'Money Myths', description: 'Faceless English-language explainers that take apart popular personal-finance myths with clear numbers.', niche: 'personal finance', audience: 'Beginners who want to understand money without jargon', tone: 'Clear, curious, a little wry', language: 'English', bannedTopics: [], postingPerWeek: 1, createdAt: new Date().toISOString()};
  fs.writeFileSync(`${dir}channel.json`, JSON.stringify(c, null, 2));
}
const str = (v: unknown, max: number, field: string, required = false) => {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new HttpError(422, `${field} must be text.`);
  const t = v.trim();
  if (required && !t) throw new HttpError(422, `${field} is required.`);
  if (t.length > max) throw new HttpError(422, `${field} is too long (max ${max} characters).`);
  return t;
};
/** Optional profile fields the Studio form edits (accent, say voice, style, branding); invalid branding numbers fall back to defaults. */
function extras(b: Record<string, unknown>): Partial<Channel> {
  const o: Partial<Channel> = {}, a = str(b.accent, 40, 'Accent'), sv = str(b.sayVoice, 60, 'Say voice'), vs = str(b.voiceStyle, 300, 'Voice style');
  if (a) o.accent = a; if (sv) o.sayVoice = sv; if (vs) o.voiceStyle = vs;
  const br = b.branding;
  if (br && typeof br === 'object') {
    const x = br as Record<string, unknown>, handle = str(x.handle, 40, 'Handle'), cta = str(x.cta, 60, 'Call to action'), sec = Number(x.outroSec ?? 2);
    o.branding = {...(handle ? {handle} : {}), ...(cta ? {cta} : {}), outroSec: Number.isFinite(sec) ? Math.min(6, Math.max(0, sec)) : 2, watermark: x.watermark !== false};
  }
  return o;
}
function checkChannel(b: Record<string, unknown>, id: string, createdAt: string): Channel {
  const banned = Array.isArray(b.bannedTopics) ? b.bannedTopics : typeof b.bannedTopics === 'string' ? b.bannedTopics.split(/[,\n]/) : [];
  if (!banned.every(x => typeof x === 'string')) throw new HttpError(422, 'bannedTopics must be a list of text.');
  const ppw = b.postingPerWeek === undefined || b.postingPerWeek === '' ? 1 : Number(b.postingPerWeek);
  if (!Number.isInteger(ppw) || ppw < 0 || ppw > 21) throw new HttpError(422, 'Posts per week must be a whole number from 0 to 21.');
  const voiceId = str(b.voiceId, 80, 'Voice ID');
  return {
    id, name: str(b.name, 80, 'Name', true), description: str(b.description, 2000, 'Description'), niche: str(b.niche, 200, 'Niche'),
    audience: str(b.audience, 400, 'Audience'), tone: str(b.tone, 400, 'Tone'), language: str(b.language, 60, 'Language') || 'English',
    ...(voiceId ? {voiceId} : {}), bannedTopics: (banned as string[]).map(x => x.trim()).filter(Boolean).slice(0, 50), postingPerWeek: ppw, createdAt, ...extras(b),
  };
}
function readChannel(id: string): Channel | null {
  const c = readJson<Partial<Channel>>(`${chDir(id)}channel.json`);
  if (!c || typeof c !== 'object') return null;
  return {id, name: typeof c.name === 'string' && c.name ? c.name : id, description: c.description ?? '', niche: c.niche ?? '', audience: c.audience ?? '', tone: c.tone ?? '', language: c.language ?? 'English', ...(c.voiceId ? {voiceId: c.voiceId} : {}), bannedTopics: Array.isArray(c.bannedTopics) ? c.bannedTopics.filter(x => typeof x === 'string') : [], postingPerWeek: typeof c.postingPerWeek === 'number' ? c.postingPerWeek : 1, createdAt: c.createdAt ?? '', ...extras(c as Record<string, unknown>)};
}
const listChannels = () => { ensureDefaultChannel(); return (fs.existsSync(CHANNELS) ? fs.readdirSync(CHANNELS) : []).filter(d => ID_RE.test(d)).map(readChannel).filter((c): c is Channel => !!c); };
const episodesOf = (channel: string) => (fs.existsSync(EPISODES) ? fs.readdirSync(EPISODES) : []).filter(d => fs.existsSync(`${EPISODES}${d}/episode.json`)).map(episodeSummary).filter(e => e.channel === channel);

type Idea = {id: string; title: string; angle: string; hook: string; whyInteresting: string; format: string; difficulty: string; needsSources: string[]; device?: string; viewer?: string; facts?: {fact: string; source?: string; calc?: string}[]; status: 'new' | 'drafted' | 'dismissed'; episodeId?: string; createdAt: string};
type IdeasFile = {generatedAt: string; ideas: Idea[]};
function readIdeas(channel: string): IdeasFile {
  const f = readJson<{generatedAt?: unknown; ideas?: unknown}>(`${chDir(channel)}ideas.json`);
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const ideas = (Array.isArray(f?.ideas) ? f.ideas : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).id === 'string' && typeof (x as Record<string, unknown>).title === 'string').map((x): Idea => ({
    id: x.id as string, title: x.title as string, angle: s(x.angle), hook: s(x.hook), whyInteresting: s(x.whyInteresting), format: s(x.format), difficulty: s(x.difficulty),
    needsSources: Array.isArray(x.needsSources) ? x.needsSources.filter((y): y is string => typeof y === 'string') : [],
    ...(typeof x.device === 'string' ? {device: x.device} : {}), ...(typeof x.viewer === 'string' ? {viewer: x.viewer} : {}),
    ...(Array.isArray(x.facts) ? {facts: (x.facts as Record<string, unknown>[]).filter(y => y && typeof y.fact === 'string').map(y => ({fact: y.fact as string, ...(typeof y.source === 'string' ? {source: y.source} : {}), ...(typeof y.calc === 'string' ? {calc: y.calc} : {})}))} : {}),
    status: x.status === 'drafted' || x.status === 'dismissed' ? x.status : 'new', ...(typeof x.episodeId === 'string' ? {episodeId: x.episodeId} : {}), createdAt: s(x.createdAt),
  }));
  return {generatedAt: s(f?.generatedAt), ideas};
}
const writeIdeas = (channel: string, f: IdeasFile) => fs.writeFileSync(`${chDir(channel)}ideas.json`, JSON.stringify(f, null, 2));
const needChannel = (id: string) => { ensureDefaultChannel(); const c = readChannel(id); if (!c) throw new HttpError(404, 'Channel not found.'); return c; };

function overview() {
  const mt = (f: string) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
  return listChannels().map(channel => {
    const eps = episodesOf(channel.id);
    let last: {id: string; at: string} | null = null, lastMs = 0;
    for (const e of eps) { const t = Math.max(mt(`${EPISODES}${e.id}/build/${e.id}-final.mp4`), mt(`${EPISODES}${e.id}/build/${e.id}-preview.mp4`)); if (t > lastMs) { lastMs = t; last = {id: e.id, at: new Date(t).toISOString()}; } }
    const unfinished = eps.find(e => !e.stages.final);
    return {channel, episodes: eps.length, rendered: eps.filter(e => e.stages.final).length, ideasNew: readIdeas(channel.id).ideas.filter(i => i.status === 'new').length, lastRender: last, unfinished: unfinished ? {id: unfinished.id, title: unfinished.title} : null};
  });
}

// ---------- media (Range) ----------
function sendFile(req: http.IncomingMessage, res: http.ServerResponse, file: string) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(file).size, type = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.png') ? 'image/png' : AUDIO_EXT[file.split('.').pop() ?? ''] ?? (file.endsWith('.vtt') ? 'text/vtt; charset=utf-8' : file.endsWith('.srt') ? 'text/plain' : 'application/octet-stream');
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0, end = size - 1, partial = false;
  if (range && (range[1] || range[2])) {
    partial = true;
    if (!range[1]) { start = Math.max(0, size - Number(range[2])); }
    else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
    if (start >= size || start > end) { res.writeHead(416, {'Content-Range': `bytes */${size}`}); return res.end(); }
  }
  const stream = fs.createReadStream(file, {start, end});
  stream.on('error', () => res.destroy());
  res.writeHead(partial ? 206 : 200, {...(partial ? {'Content-Range': `bytes ${start}-${end}/${size}`} : {}), 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type});
  stream.pipe(res);
}

const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
function readPack(d: string) {
  const f = readJson<Record<string, unknown>>(`${d}build/publish.json`);
  if (!f || typeof f !== 'object') return null;
  const chapters = (Array.isArray(f.chapters) ? f.chapters : []).filter((c): c is {startSec: number; title: string} => !!c && typeof (c as {startSec?: unknown}).startSec === 'number' && typeof (c as {title?: unknown}).title === 'string');
  return {titles: strList(f.titles), description: typeof f.description === 'string' ? f.description : '', tags: strList(f.tags), chapters, thumbnailText: strList(f.thumbnailText), source: f.source === 'ai' ? 'ai' : 'fallback'};
}
async function draftEpisode(topic: string, angle: string, channel: string, wantId?: string, short = false) {
  needAi('draft');
  const id = wantId ?? nextId(topic);
  if (!ID_RE.test(id)) throw new HttpError(400, 'Invalid episode id.');
  if (fs.existsSync(epDir(id))) throw new HttpError(409, `Episode ${id} already exists.`);
  const release = lockAi();
  try {
    const {code, out} = await runDraft(topic, id, angle, channel, short);
    const ok = out.filter(l => l.startsWith('DRAFT_OK')).pop();
    if (code === 0 && ok && fs.existsSync(`${EPISODES}${id}/episode.json`)) return {id, path: ok.slice(8).trim(), log: out.slice(-40)};
    throw new HttpError(422, cliMessage(out, code));
  } finally { release(); }
}
// ---------- data lane: status, versions, search, trash, queue, pipeline, cost, notes ----------
type EpStatus = {state: 'draft' | 'scheduled' | 'published'; youtubeUrl?: string; publishedAt?: string; scheduledFor?: string; archived?: boolean};
function readStatus(id: string): EpStatus {
  const f = readJson<Partial<EpStatus>>(`${epDir(id)}status.json`) ?? {};
  const state = f.state === 'scheduled' || f.state === 'published' ? f.state : 'draft';
  return {state, ...(f.youtubeUrl ? {youtubeUrl: f.youtubeUrl} : {}), ...(f.publishedAt ? {publishedAt: f.publishedAt} : {}), ...(f.scheduledFor ? {scheduledFor: f.scheduledFor} : {}), ...(f.archived ? {archived: true} : {})};
}
const writeStatus = (id: string, s: EpStatus) => fs.writeFileSync(`${epDir(id)}status.json`, JSON.stringify(s, null, 2));
const isoDate = (v: unknown, field: string) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw new HttpError(422, `${field} must be a date (ISO 8601).`);
  return new Date(v).toISOString();
};
function checkStatus(b: Record<string, unknown>, cur: EpStatus): EpStatus {
  if (b.state !== 'draft' && b.state !== 'scheduled' && b.state !== 'published') throw new HttpError(422, 'state must be draft, scheduled or published.');
  const url = typeof b.youtubeUrl === 'string' ? b.youtubeUrl.trim() : '';
  if (url && !/^https?:\/\/\S+$/.test(url)) throw new HttpError(422, 'youtubeUrl must be an http(s) link.');
  const scheduledFor = isoDate(b.scheduledFor, 'scheduledFor');
  if (b.state === 'scheduled' && !scheduledFor) throw new HttpError(422, 'scheduledFor is required when state is scheduled.');
  const publishedAt = b.state === 'published' ? isoDate(b.publishedAt, 'publishedAt') ?? cur.publishedAt ?? new Date().toISOString() : undefined;
  return {state: b.state, ...(url ? {youtubeUrl: url} : {}), ...(publishedAt ? {publishedAt} : {}), ...(b.state === 'scheduled' && scheduledFor ? {scheduledFor} : {}), ...(cur.archived ? {archived: true} : {})};
}

// versions: episodes/<id>/history/<epochMs>.json = {at, episode}
const MAX_VERSIONS = 50, SNAP_GAP_MS = 20_000;
const versionIds = (d: string) => (fs.existsSync(`${d}history/`) ? fs.readdirSync(`${d}history/`) : []).filter(f => /^\d{13}\.json$/.test(f)).map(f => f.slice(0, -5)).sort().reverse();
/** Save the current episode.json before it changes. Debounced unless force; skips identical content. */
function snapshot(d: string, force: boolean) {
  const cur = readJson<{title?: string}>(`${d}episode.json`);
  if (!cur) return;
  const ids = versionIds(d), last = ids[0];
  if (last) {
    if (!force && Date.now() - Number(last) < SNAP_GAP_MS) return;
    if (JSON.stringify(readJson<{episode?: unknown}>(`${d}history/${last}.json`)?.episode) === JSON.stringify(cur)) return;
  }
  fs.mkdirSync(`${d}history/`, {recursive: true});
  let t = Date.now(); while (fs.existsSync(`${d}history/${t}.json`)) t++;
  fs.writeFileSync(`${d}history/${t}.json`, JSON.stringify({at: new Date(t).toISOString(), episode: cur}));
  for (const old of versionIds(d).slice(MAX_VERSIONS)) fs.rmSync(`${d}history/${old}.json`, {force: true});
}

const runningFor = (id: string) => [...jobs.values()].some(j => j.episode === id && (j.status === 'running' || j.status === 'queued'));
const allEpisodeIds = () => (fs.existsSync(EPISODES) ? fs.readdirSync(EPISODES) : []).filter(d => ID_RE.test(d) && fs.existsSync(`${EPISODES}${d}/episode.json`));
const chFilter = (url: URL) => { const ch = url.searchParams.get('ch'); if (!ch || ch === 'all') return null; chDir(ch); return ch; };

function episodeCost(d: string) {
  const ep = readJson<{scenes?: {narration?: string}[]}>(`${d}episode.json`);
  const scenes = ep?.scenes ?? [];
  let chars = 0, cachedChars = 0, images = 0;
  scenes.forEach((s, i) => {
    const n = (s.narration ?? '').length; chars += n;
    if (sceneAudio(d, i + 1)?.source === 'generated') cachedChars += n;
    if (!fs.existsSync(`${d}art/scene-${i + 1}.png`)) images++;
  });
  const artOn = !!process.env.ART_PROVIDER && process.env.ART_PROVIDER !== 'none';
  const perK = Number(process.env.COST_PER_1K_CHARS ?? 0.3), perImg = Number(process.env.COST_PER_IMAGE ?? 0.04);
  const budget = process.env.STUDIO_BUDGET_USD ? Number(process.env.STUDIO_BUDGET_USD) : undefined;
  const estUsd = Math.round(((chars - cachedChars) / 1000 * perK + (artOn ? images * perImg : 0)) * 100) / 100;
  return {chars, cachedChars, images, estUsd, ...(budget !== undefined && Number.isFinite(budget) ? {budget} : {})};
}

async function episodeDataApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL, p: string[], m: string, id: string, d: string): Promise<boolean> {
  if (p.length === 2 && m === 'DELETE') {
    if (runningFor(id)) throw new HttpError(409, 'A run is using this episode. Cancel it first.');
    fs.mkdirSync(`${EPISODES}_trash/`, {recursive: true});
    fs.renameSync(d, `${EPISODES}_trash/${id}-${Date.now()}`);
    json(res, 200, {ok: true}); return true;
  }
  if (p[2] === 'status' && p.length === 3) {
    if (m === 'GET') { json(res, 200, readStatus(id)); return true; }
    if (m === 'PUT') { const s = checkStatus(await body(req, StatusBody), readStatus(id)); writeStatus(id, s); json(res, 200, s); return true; }
  }
  if (p[2] === 'archive' && p.length === 3 && m === 'POST') {
    const b = await body(req, ArchiveBody).catch(() => ({} as z.infer<typeof ArchiveBody>));
    const s = readStatus(id); const archived = b.archived !== false;
    if (archived) s.archived = true; else delete s.archived;
    writeStatus(id, s); json(res, 200, {ok: true, archived}); return true;
  }
  if (p[2] === 'duplicate' && p.length === 3 && m === 'POST') {
    const b = await body(req, DuplicateBody);
    if (typeof b.id !== 'string' || !ID_RE.test(b.id)) throw new HttpError(400, 'Use lowercase letters, numbers and dashes only.');
    const nd = epDir(b.id);
    if (fs.existsSync(nd)) throw new HttpError(409, `Episode ${b.id} already exists.`);
    const src = readJson<Record<string, unknown>>(`${d}episode.json`);
    if (!src) throw new HttpError(404, 'Episode has no episode.json.');
    fs.mkdirSync(nd, {recursive: true});
    fs.writeFileSync(`${nd}episode.json`, JSON.stringify({...src, id: b.id, title: `${typeof src.title === 'string' ? src.title : id} (copy)`}, null, 2));
    for (const f of ['audio', 'art', 'notes.json']) if (fs.existsSync(`${d}${f}`)) fs.cpSync(`${d}${f}`, `${nd}${f}`, {recursive: true}); // cached audio keeps credits
    json(res, 201, episodeSummary(b.id)); return true;
  }
  if (p[2] === 'versions') {
    if (p.length === 3 && m === 'GET') {
      const ids = versionIds(d);
      const docs = ids.map(v => readJson<{at?: string; episode?: {title?: string; scenes?: unknown[]}}>(`${d}history/${v}.json`));
      json(res, 200, ids.map((v, i) => ({id: v, at: docs[i]?.at ?? new Date(Number(v)).toISOString(), scenes: docs[i]?.episode?.scenes?.length ?? 0, titleChanged: i + 1 < ids.length && docs[i]?.episode?.title !== docs[i + 1]?.episode?.title})));
      return true;
    }
    if (p[3] && /^\d{13}$/.test(p[3]) && p.length === 4 && m === 'GET') {
      const v = readJson<{at: string; episode: unknown}>(`${d}history/${p[3]}.json`);
      if (!v) throw new HttpError(404, 'Version not found.');
      json(res, 200, v); return true;
    }
    if (p[3] && p[4] === 'restore' && p.length === 5 && m === 'POST') {
      if (!/^\d{13}$/.test(p[3])) throw new HttpError(400, 'Invalid version id.');
      const v = readJson<{episode?: unknown}>(`${d}history/${p[3]}.json`);
      if (!v?.episode) throw new HttpError(404, 'Version not found.');
      const parsed = Episode.safeParse(v.episode);
      if (!parsed.success) throw new HttpError(422, 'Stored version is no longer valid.');
      snapshot(d, true);
      fs.writeFileSync(`${d}episode.json`, JSON.stringify({...parsed.data, id}, null, 2));
      json(res, 200, {ok: true}); return true;
    }
  }
  if (p[2] === 'cost' && p.length === 3 && m === 'GET') { json(res, 200, episodeCost(d)); return true; }
  if (p[2] === 'notes' && p.length === 3) {
    if (m === 'GET') { json(res, 200, {notes: readJson<{notes?: unknown}>(`${d}notes.json`)?.notes ?? {}}); return true; }
    if (m === 'PUT') {
      const b = await body(req, NotesBody);
      if (!b.notes || typeof b.notes !== 'object' || Array.isArray(b.notes)) throw new HttpError(422, 'notes must be an object of scene index to list of text.');
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(b.notes)) {
        if (!/^\d+$/.test(k) || !Array.isArray(v) || !v.every(x => typeof x === 'string' && x.length <= 2000) || v.length > 50) throw new HttpError(422, 'notes must be {[sceneIndex]: string[]} (max 50 notes, 2000 characters each).');
        if (v.length) out[k] = v;
      }
      fs.writeFileSync(`${d}notes.json`, JSON.stringify({notes: out}, null, 2));
      json(res, 200, {notes: out}); return true;
    }
  }
  if (p[2] === 'scenes' && p[3] && p[4] === 'regenerate' && p.length === 5 && m === 'POST') {
    const n = Number(p[3]), count = sceneCount(d);
    if (!/^\d+$/.test(p[3]) || n < 1 || n > count) throw new HttpError(400, `Scene must be 1 to ${count}.`);
    const b = await body(req, RegenerateBody);
    const engine = String(b.engine ?? readEnv().STUDIO_ENGINE ?? process.env.STUDIO_ENGINE ?? 'auto');
    if (b.kind === 'preview') { const r = enqueue(id, {stages: ['direct', 'preview'], engine}); json(res, 202, r); return true; }
    if (b.kind !== 'voice') throw new HttpError(400, 'kind must be voice or preview.');
    const a = sceneAudio(d, n);
    if (engine === 'local') throw new HttpError(422, 'Own-voice scenes are re-recorded, not regenerated.');
    if (a?.source === 'generated' && b.confirm !== true && b.confirm !== 'generated') throw new HttpError(409, 'Regenerating this scene deletes paid ElevenLabs audio. Repeat with confirm: true to proceed.');
    const r = enqueue(id, {stages: ['voice', 'direct'], engine}); // validates first; then drop this scene's cache so tts re-synthesizes only it
    rmSceneAudio(d, n);
    json(res, 202, r); return true;
  }
  return false;
}

async function globalDataApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL, p: string[], m: string): Promise<boolean> {
  if (p[0] === 'search' && m === 'GET') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase(), ch = chFilter(url);
    if (!q) { json(res, 200, {episodes: [], ideas: [], scenes: []}); return true; }
    const hit = (...xs: (string | undefined)[]) => xs.some(x => x?.toLowerCase().includes(q));
    const episodes: {id: string; title: string; channel: string; status: string}[] = [], scenes: {ep: string; n: number; text: string}[] = [];
    for (const id of allEpisodeIds()) {
      const ep = readJson<{title?: string; channel?: string; scenes?: {narration?: string}[]}>(`${EPISODES}${id}/episode.json`);
      const channel = ep?.channel ?? 'default';
      if (!ep || (ch && channel !== ch)) continue;
      const st = readStatus(id);
      if (st.archived) continue;
      if (hit(id, ep.title, channel) && episodes.length < 20) episodes.push({id, title: ep.title ?? id, channel, status: st.state});
      (ep.scenes ?? []).forEach((s, i) => { if (scenes.length < 30 && hit(s.narration)) scenes.push({ep: id, n: i + 1, text: s.narration ?? ''}); });
    }
    const ideas = listChannels().filter(c => !ch || c.id === ch).flatMap(c => readIdeas(c.id).ideas.filter(i => i.status !== 'dismissed' && hit(i.title, i.angle, i.hook)).map(i => ({id: i.id, title: i.title, channel: c.id, status: i.status}))).slice(0, 20);
    json(res, 200, {episodes, ideas, scenes}); return true;
  }
  if (p[0] === 'pipeline' && m === 'GET') {
    const ch = chFilter(url);
    const columns: Record<'idea' | 'script' | 'voiced' | 'rendered' | 'published', unknown[]> = {idea: [], script: [], voiced: [], rendered: [], published: []};
    for (const c of listChannels().filter(c => !ch || c.id === ch)) {
      for (const i of readIdeas(c.id).ideas) if (i.status === 'new') columns.idea.push({id: i.id, title: i.title, channel: c.id, kind: 'idea', angle: i.angle});
    }
    for (const id of allEpisodeIds()) {
      const e = episodeSummary(id);
      if (ch && e.channel !== ch) continue;
      if (e.status.archived) continue;
      const card = {id, title: e.title, channel: e.channel, kind: 'episode', scenes: e.scenes, totalSec: e.totalSec, state: e.status.state, stale: e.stale, scheduledFor: e.status.scheduledFor, publishedAt: e.status.publishedAt};
      const col = e.status.state === 'published' ? 'published' : e.stages.final ? 'rendered' : e.stages.voice ? 'voiced' : 'script';
      columns[col].push(card);
    }
    json(res, 200, {columns}); return true;
  }
  if (p[0] === 'queue') {
    if (p.length === 1 && m === 'GET') { json(res, 200, queueState()); return true; }
    if (p.length === 1 && m === 'POST') {
      const b = await body(req, QueueBody);
      if (typeof b.episode !== 'string') throw new HttpError(400, 'episode is required.');
      json(res, 202, enqueue(b.episode, b)); return true;
    }
    if (p[1] === 'events' && m === 'GET') {
      res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
      queueClients.add(res); req.on('close', () => queueClients.delete(res));
      res.write(`data: ${JSON.stringify(queueState())}\n\n`); return true;
    }
    if (p[1] && p.length === 2 && m === 'DELETE') {
      const job = jobs.get(p[1]);
      if (!job) throw new HttpError(404, 'Run not found.');
      if (job.status !== 'queued' && job.status !== 'running') throw new HttpError(409, `Run is already ${job.status}.`);
      const wasRunning = job.status === 'running';
      job.status = 'cancelled'; job.current = null; if (wasRunning) job.child?.kill();
      emit(job); if (!wasRunning) pump();
      json(res, 200, {ok: true}); return true;
    }
  }
  return false;
}

async function channelApi(req: http.IncomingMessage, res: http.ServerResponse, _url: URL, p: string[], m: string) {
  if (p.length === 1) {
    if (m === 'GET') return json(res, 200, listChannels().map(c => ({...c, episodes: episodesOf(c.id).length})));
    if (m === 'POST') {
      const b = await body(req, ChannelBody);
      const id = typeof b.id === 'string' && b.id ? b.id : String(b.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const dir = chDir(id);
      ensureDefaultChannel();
      if (fs.existsSync(`${dir}channel.json`)) throw new HttpError(409, `Channel ${id} already exists.`);
      const c = checkChannel(b, id, new Date().toISOString());
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(`${dir}channel.json`, JSON.stringify(c, null, 2));
      return json(res, 201, c);
    }
  }
  const id = p[1], dir = chDir(id);
  const cur = needChannel(id);
  if (p.length === 2) {
    if (m === 'GET') return json(res, 200, cur);
    if (m === 'PUT') {
      const c = checkChannel(await body(req, ChannelBody), id, cur.createdAt || new Date().toISOString());
      fs.writeFileSync(`${dir}channel.json`, JSON.stringify(c, null, 2));
      return json(res, 200, c);
    }
    if (m === 'DELETE') {
      if (id === 'default') throw new HttpError(409, 'The default channel cannot be deleted.');
      const n = episodesOf(id).length;
      if (n) throw new HttpError(409, `This channel has ${n} ${n === 1 ? 'episode' : 'episodes'}. Move or delete them first.`);
      fs.rmSync(dir, {recursive: true, force: true});
      return json(res, 200, {ok: true});
    }
  }
  if (p[2] === 'ideas') {
    if (p.length === 3 && m === 'GET') return json(res, 200, {...readIdeas(id), installed: scriptInstalled('ideas')});
    if (p[3] === 'generate' && p.length === 4 && m === 'POST') {
      const b = await body(req, IdeasGenerateBody);
      const focus = typeof b.focus === 'string' ? b.focus.trim().replace(/[\r\n]+/g, ' ').slice(0, 300) : '';
      const count = b.count === undefined ? 10 : Number(b.count);
      if (!Number.isInteger(count) || count < 1 || count > 20) throw new HttpError(400, 'Count must be a whole number from 1 to 20.');
      needAi('ideas');
      const release = lockAi();
      try {
        const {code, out} = await runNpm(['ideas', '--', '--channel', id, '--count', String(count), '--scout', ...(focus ? ['--focus', focus] : [])]);
        if (code === 0 && out.some(l => l.startsWith('IDEAS_OK'))) return json(res, 200, {...readIdeas(id), installed: true});
        return json(res, 422, {error: cliMessage(out, code), log: out.slice(-40)});
      } finally { release(); }
    }
    if (p[3] && p.length === 5 && p[4] === 'draft' && m === 'POST') {
      const f = readIdeas(id), idea = f.ideas.find(i => i.id === p[3]);
      if (!idea) throw new HttpError(404, 'Idea not found.');
      const b = await body(req, DraftBody);
      const angle = [idea.angle, idea.hook && `Opening idea: ${idea.hook}`, idea.viewer && `For: ${idea.viewer}`, ...(idea.facts ?? []).map(x => `Fact: ${x.fact}${x.calc ? ` (${x.calc})` : ''}${x.source ? ` [${x.source}]` : ''}`)].filter(Boolean).join('\n');
      const j = startDraft({topic: idea.title, angle, channel: id, short: b.format === 'short', ideaId: idea.id, device: idea.device});
      return json(res, 202, {id: j.id, draft: true});
    }
    if (p[3] && p.length === 4 && m === 'PATCH') {
      const b = await body(req, IdeaStatusBody);
      if (b.status !== 'new' && b.status !== 'dismissed') throw new HttpError(400, 'status must be new or dismissed.');
      const f = readIdeas(id), idea = f.ideas.find(i => i.id === p[3]);
      if (!idea) throw new HttpError(404, 'Idea not found.');
      idea.status = b.status; writeIdeas(id, f);
      return json(res, 200, idea);
    }
  }
  json(res, 404, {error: 'Not found.'});
}

// ---------- API ----------
async function api(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const p = url.pathname.replace(/^\/api\//, '').split('/');
  const m = req.method ?? 'GET';
  try {
    if (p[0] === 'episodes' && p[1] === 'import' && p.length === 2 && m === 'POST') {
      const buf = await readRaw(req, 500 * 1024 * 1024);
      const want = url.searchParams.get('id');
      if (want !== null && !ID_RE.test(want)) return json(res, 400, {error: 'Use lowercase letters, numbers and dashes only.'});
      const tmpId = `import-${randomUUID().slice(0, 8)}`, tmpDir = `${EPISODES}.${tmpId}/`;
      try {
        importEpisodeZip(buf, tmpDir);
        const ep = Episode.safeParse(readJson(`${tmpDir}episode.json`));
        if (!ep.success) throw new HttpError(422, `episode.json in the ZIP is invalid: ${ep.error.issues[0]?.message ?? ''}`);
        const id = want ?? ep.data.id;
        if (!ID_RE.test(id)) throw new HttpError(422, 'The episode id in the ZIP is not valid.');
        if (fs.existsSync(epDir(id))) throw new HttpError(409, `Episode ${id} already exists. Pass ?id=<new-id> to import under another name.`);
        fs.writeFileSync(`${tmpDir}episode.json`, JSON.stringify({...ep.data, id}, null, 2));
        fs.renameSync(tmpDir, epDir(id));
        return json(res, 201, episodeSummary(id));
      } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(422, (e as Error).message); }
      finally { fs.rmSync(tmpDir, {recursive: true, force: true}); }
    }
    if (p[0] === 'episodes' && p.length === 1) {
      if (m === 'GET') {
        const ch = url.searchParams.get('channel');
        if (ch !== null) chDir(ch);
        const all = fs.readdirSync(EPISODES).filter(d => fs.existsSync(`${EPISODES}${d}/episode.json`)).map(episodeSummary);
        return json(res, 200, ch === null ? all : all.filter(e => e.channel === ch));
      }
      if (m === 'POST') {
        const {id, channel = 'default'} = await body(req, NewEpisodeBody);
        if (typeof id !== 'string' || !ID_RE.test(id)) return json(res, 400, {error: 'Use lowercase letters, numbers and dashes only.'});
        needChannel(typeof channel === 'string' ? channel : '');
        const dir = epDir(id);
        if (fs.existsSync(dir)) return json(res, 409, {error: `Episode ${id} already exists.`});
        fs.mkdirSync(`${dir}audio`, {recursive: true});
        fs.writeFileSync(`${dir}episode.json`, JSON.stringify({id, channel, title: 'Untitled', series: 'money-myths', scenes: [{type: 'title', narration: 'Your hook goes here.', emotion: 'smug'}], sources: [], disclaimer: true}, null, 2));
        return json(res, 201, episodeSummary(id));
      }
    }
    if (p[0] === 'episodes' && p[1]) {
      const id = p[1], d = epDir(id);
      if (!fs.existsSync(d)) return json(res, 404, {error: 'Episode not found.'});
      if (p.length === 2) {
        if (m === 'GET') return json(res, 200, {episode: Episode.parse(readJson(`${d}episode.json`)), decisions: readJson(`${d}build/decisions.json`), timings: readJson(`${d}build/timings.json`), variety: fs.existsSync(`${d}build/variety.md`) ? fs.readFileSync(`${d}build/variety.md`, 'utf8') : null, summary: episodeSummary(id), audio: Array.from({length: sceneCount(d)}, (_, i) => sceneAudio(d, i + 1)), shorts: fs.existsSync(`${d}build/shorts/`) ? fs.readdirSync(`${d}build/shorts/`).filter(f => f.endsWith('.mp4')) : []});
        if (m === 'PUT') {
          const parsed = Episode.safeParse(await body(req));
          if (!parsed.success) return json(res, 422, {error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')});
          if (parsed.data.id !== id) return json(res, 422, {error: 'Episode id cannot change.'});
          snapshot(d, false);
          fs.writeFileSync(`${d}episode.json`, JSON.stringify(parsed.data, null, 2));
          return json(res, 200, {ok: true});
        }
      }
      if (p[2] === 'audio' && p[3]) {
        const n = Number(p[3]), count = sceneCount(d);
        if (!/^\d+$/.test(p[3]) || n < 1 || n > count) throw new HttpError(400, `Scene must be 1 to ${count}.`);
        if (m === 'POST') {
          const ext = url.searchParams.get('ext') ?? '';
          if (!(ext in AUDIO_EXT)) throw new HttpError(400, 'ext must be wav, mp3 or m4a.');
          requireGeneratedConfirm(d, n, url, 'Replacing');
          const buf = await readRaw(req, MAX_AUDIO);
          if (!buf.length) throw new HttpError(400, 'Empty audio file.');
          fs.mkdirSync(`${d}audio`, {recursive: true});
          rmSceneAudio(d, n);
          fs.writeFileSync(`${d}audio/scene-${n}.${ext}`, buf);
          return json(res, 200, sceneAudio(d, n));
        }
        if (m === 'DELETE') {
          if (!sceneAudio(d, n)) throw new HttpError(404, 'No recording for this scene.');
          requireGeneratedConfirm(d, n, url, 'Removing');
          rmSceneAudio(d, n);
          return json(res, 200, {ok: true});
        }
        if (m === 'GET') { const a = sceneAudio(d, n); if (!a) return json(res, 404, {error: 'No recording for this scene.'}); return sendFile(req, res, `${d}audio/${a.file}`); }
      }
      if (p[2] === 'export' && p.length === 3 && m === 'GET') {
        const z = exportEpisodeZip(d);
        res.writeHead(200, {'Content-Type': 'application/zip', 'Content-Length': z.length, 'Content-Disposition': `attachment; filename="${id}.zip"`}); res.end(z); return;
      }
      if (p[2] === 'generate' && m === 'POST') {
        return json(res, 202, {jobId: enqueue(id, await body(req, GenerateBody)).jobId});
      }
      if (await episodeDataApi(req, res, url, p, m, id, d)) return;
      if (p[2] === 'publish' && p.length === 3) {
        if (m === 'GET') return json(res, 200, {pack: readPack(d)});
        if (m === 'POST') {
          needAi('publish-pack');
          const release = lockAi();
          try {
            const {code, out} = await runNpm(['publish-pack', '--', id]);
            const ok = out.filter(l => l.startsWith('PACK_OK')).pop();
            const pack = readPack(d);
            if (code === 0 && ok && pack) return json(res, 200, {pack});
            return json(res, 422, {error: cliMessage(out, code)});
          } finally { release(); }
        }
      }
      if (p[2] === 'thumbnail' && p.length === 3 && m === 'POST') {
        const b = await body(req, ThumbBody);
        const text = typeof b.text === 'string' ? b.text.trim().replace(/[\r\n]+/g, ' ').slice(0, 60) : '';
        const {code, out} = await runNpm(['thumbnail', '--', id, ...(text ? ['--text', text] : [])]);
        if (code === 0 && out.some(l => l.startsWith('THUMB_OK'))) return json(res, 200, {ok: true, at: Date.now()});
        return json(res, 422, {error: cliMessage(out, code)});
      }
      if (p[2] === 'media' && p[3]?.endsWith('.vtt')) { // built in memory: a GET writes nothing
        try {
          const dec = JSON.parse(fs.readFileSync(`${d}build/decisions.json`, 'utf8')), tim = JSON.parse(fs.readFileSync(`${d}build/timings.json`, 'utf8'));
          res.writeHead(200, {'Content-Type': 'text/vtt; charset=utf-8', 'Content-Disposition': `attachment; filename="${id}.vtt"`});
          return void res.end(toVtt(buildPhrases(sceneWords(dec, tim))));
        } catch (e) { return json(res, 422, {error: `Subtitles need a voiced and directed episode: ${friendlyError((e as Error).message)}`}); }
      }
      if (p[2] === 'media' && p[3]) return sendFile(req, res, `${d}build/${path.basename(p[3])}`);
      if (p[2] === 'shorts' && p[3]) return sendFile(req, res, `${d}build/shorts/${path.basename(p[3])}`);
    }
    if (p[0] === 'make' && m === 'POST') { // one click: draft -> voice -> direct -> preview
      const b = await body(req, MakeBody);
      const topic = typeof b.topic === 'string' ? b.topic.trim().replace(/[\r\n]+/g, ' ').replace(/^-+\s*/, '') : ''; // a leading dash would be read as a CLI option
      const angle = typeof b.angle === 'string' ? b.angle.trim().replace(/[\r\n]+/g, ' ') : '';
      if (!topic) return json(res, 400, {error: 'Enter a topic first.'});
      const channel = typeof b.channel === 'string' && b.channel ? b.channel : 'default';
      needChannel(channel);
      const engine = String(b.engine ?? readEnv().STUDIO_ENGINE ?? process.env.STUDIO_ENGINE ?? 'auto');
      const j = startDraft({topic, angle, channel, short: b.format === 'short', model: typeof b.model === 'string' ? b.model.replace(/[^\w.:-]/g, '') : '', make: {stages: b.stopAtPreview === false ? ['voice', 'direct', 'final'] : ['voice', 'direct', 'preview'], engine}});
      return json(res, 202, {id: j.id, draft: true});
    }
    if (p[0] === 'draft' && m === 'POST') {
      const b = await body(req, DraftBody);
      const topic = typeof b.topic === 'string' ? b.topic.trim().replace(/[\r\n]+/g, ' ').replace(/^-+\s*/, '') : ''; // a leading dash would be read as a CLI option
      const angle = typeof b.angle === 'string' ? b.angle.trim().replace(/[\r\n]+/g, ' ') : '';
      if (!topic) return json(res, 400, {error: 'Enter a topic first.'});
      const channel = typeof b.channel === 'string' && b.channel ? b.channel : 'default';
      needChannel(channel);
      return json(res, 200, await draftEpisode(topic, angle, channel, typeof b.id === 'string' && b.id ? b.id : undefined, b.format === 'short'));
    }
    if (await globalDataApi(req, res, url, p, m)) return;
    if (p[0] === 'presets') {
      if (m === 'GET' && p.length === 1) return json(res, 200, listPresets());
      if (m === 'POST' && p.length === 1) { // save a channel's profile as a user preset
        const b = await body(req, PresetBody), c = needChannel(String(b.channel ?? ''));
        try { return json(res, 201, {id: savePreset(String(b.id ?? ''), c)}); } catch (e) { throw new HttpError(422, (e as Error).message); }
      }
      if (m === 'DELETE' && p.length === 2) { try { deletePreset(p[1]); } catch (e) { throw new HttpError(422, (e as Error).message); } return json(res, 200, {ok: true}); }
    }
    if (p[0] === 'channels') return await channelApi(req, res, url, p, m);
    if (p[0] === 'clips' && m === 'GET') {
      if (!p[1]) return json(res, 200, {job: clipJob, sources: fs.existsSync(`${ROOT}data/uploads`) ? fs.readdirSync(`${ROOT}data/uploads`).filter(f => VIDEO_RE.test(f)) : [], items: listClips()});
      const name = clipSafe(p[1]), file = clipSafe(p[2]);
      if (!name || !file || !/\.mp4$/.test(file)) return json(res, 404, {error: 'Not found.'});
      return sendFile(req, res, `${CLIP_OUT}${name}/${file}`);
    }
    if (p[0] === 'clips' && p[1] === 'upload' && m === 'POST') { // raw video body, streamed to data/uploads
      const name = clipSafe(url.searchParams.get('name'));
      if (!name || !VIDEO_RE.test(name)) throw new HttpError(400, 'Upload an mp4, mov, mkv, webm or m4v file.');
      fs.mkdirSync(`${ROOT}data/uploads`, {recursive: true});
      const dest = `${ROOT}data/uploads/${name}`, part = `${dest}.part`;
      if (fs.existsSync(dest) && url.searchParams.get('replace') !== '1') throw new HttpError(409, `${name} is already uploaded. Pick it from the list, or rename the file.`);
      const MAX_VIDEO = 10 * 1024 ** 3;
      await new Promise<void>((ok, bad) => {
        const w = fs.createWriteStream(part); let n = 0, over = false;
        req.on('data', (c: Buffer) => { n += c.length; if (n > MAX_VIDEO && !over) { over = true; req.unpipe(w); w.destroy(); req.resume(); fs.rmSync(part, {force: true}); bad(new HttpError(413, 'Video too large (max 10 GB).')); } });
        req.pipe(w); w.on('finish', () => { if (!over) { fs.renameSync(part, dest); ok(); } }); w.on('error', e => { fs.rmSync(part, {force: true}); bad(e); }); req.on('error', e => { fs.rmSync(part, {force: true}); bad(e); });
      });
      return json(res, 201, {name});
    }
    if (p[0] === 'clip' && m === 'POST') {
      if (clipJob.status === 'running') throw new HttpError(409, 'A clip run is already in progress.');
      if (!scriptInstalled('clip')) throw new HttpError(501, 'npm run clip is not installed.');
      const b = await body(req, ClipStartBody);
      const up = clipSafe(b.upload);
      const src = up ? `${ROOT}data/uploads/${up}` : typeof b.path === 'string' ? b.path.trim() : '';
      if (!src) throw new HttpError(400, 'Choose an uploaded video or enter the path of a video file on this computer.');
      if (!VIDEO_RE.test(src) || !fs.existsSync(src) || !fs.statSync(src).isFile()) throw new HttpError(400, `No video file found at ${src}.`);
      const roots = [`${ROOT}data/uploads`, ...['Movies', 'Videos', 'Downloads', 'Desktop'].map(d => path.join(os.homedir(), d)), ...(process.env.CLIP_MEDIA_DIR ? process.env.CLIP_MEDIA_DIR.split(path.delimiter) : [])];
      if (!underRoots(src, roots)) throw new HttpError(403, 'For safety the Clipper only reads videos from your Movies, Videos, Downloads or Desktop folder, the Studio uploads, or a folder listed in CLIP_MEDIA_DIR. Move the file there or upload it.');
      const num = (v: unknown, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) && v !== '' && v !== undefined ? Number(v) : d));
      const min = num(b.min, 20, 5, 120), max = Math.max(min + 5, num(b.max, 60, 10, 180)), count = Math.round(num(b.count, 5, 1, 10));
      const name = path.basename(src, path.extname(src));
      clipJob = {status: 'running', name, log: []};
      void runNpm(['clip', '--', src, '--min', String(min), '--max', String(max), '--count', String(count)]).then(({code, out}) => {
        clipJob = code === 0 ? {status: 'done', name, log: out.slice(-30)} : {status: 'error', name, log: out.slice(-30), error: out.filter(l => !l.startsWith('>')).slice(-1)[0] ?? 'Clipper failed.'};
      });
      return json(res, 202, {name});
    }
    if (p[0] === 'schedule.csv' && m === 'GET') {
      res.writeHead(200, {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="schedule.csv"'});
      return void res.end(toCsv(await scheduleRows(ROOT)));
    }
    if (p[0] === 'analytics' && m === 'GET') return json(res, 200, summarize(ROOT));
    if (p[0] === 'drafts' && p[1] && m === 'GET') { const j = drafts.get(p[1]); if (!j) return json(res, 404, {error: 'No draft is running for this episode (the Studio may have been restarted).'}); return json(res, 200, j); }
    if (p[0] === 'draft-progress' && m === 'GET') return json(res, 200, draftProgress ?? {done: 0, total: 0, label: ''});
    if (p[0] === 'readiness' && m === 'GET') return json(res, 200, await readiness());
    if (p[0] === 'overview' && m === 'GET') return json(res, 200, {channels: overview()});
    if (p[0] === 'jobs' && p[1]) {
      const job = jobs.get(p[1]);
      if (!job) return json(res, 404, {error: 'Run not found.'});
      if (p[2] === 'events') {
        res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
        job.clients.add(res); req.on('close', () => job.clients.delete(res)); emit(job); return;
      }
      if (p[2] === 'cancel' && m === 'POST') {
        if (job.status !== 'running' && job.status !== 'queued') return json(res, 409, {error: `Run is already ${job.status}.`});
        const was = job.status; job.status = 'cancelled'; job.current = null; if (was === 'running') job.child?.kill(); emit(job); if (was === 'queued') pump(); return json(res, 200, {ok: true});
      }
      if (!p[2] && m === 'GET') return json(res, 200, {id: job.id, episode: job.episode, status: job.status, current: job.current, done: job.done, progress: job.progress, error: job.error});
    }
    if (p[0] === 'voices' && m === 'GET') return json(res, 200, {lang: url.searchParams.get('lang') ?? 'en', engines: voiceEngines(url.searchParams.get('lang') ?? 'en')});
    if (p[0] === 'voice-preview') {
      if (m === 'POST') {
        const b = await body(req, VoicePreviewBody);
        if (!/^[a-z]{2}$/.test(String(b.lang ?? 'en'))) throw new HttpError(400, 'Invalid language.');
        let f: string;
        try { f = previewVoice(String(b.engine ?? 'auto'), String(b.lang ?? 'en'), `${ROOT}data/voice-preview`); } catch (e) { throw new HttpError(422, (e as Error).message); }
        return json(res, 200, {file: `/api/voice-preview/${path.basename(f)}`});
      }
      if (m === 'GET' && p[1] && /^preview-[a-z-]+-[a-z]{2}\.mp3$/.test(p[1])) return sendFile(req, res, `${ROOT}data/voice-preview/${p[1]}`);
    }
    if (p[0] === 'jobs' && !p[1]) { const running = [...jobs.values()].find(j => j.status === 'running'); return json(res, 200, {running: running?.id ?? null}); }
    if (p[0] === 'llm' && (p[1] === 'providers' || p[1] === 'test') && !p[2]) { // optional cloud AI: keys go to .env and are never echoed back
      const KEY: Record<string, [string, string]> = {gemini: ['GEMINI_API_KEY', 'GEMINI_MODEL'], groq: ['GROQ_API_KEY', 'GROQ_MODEL'], openrouter: ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL'], anthropic: ['ANTHROPIC_API_KEY', 'DRAFT_MODEL']};
      const cur = () => ({...process.env, ...readEnv()});
      if (p[1] === 'providers' && m === 'GET') { const e = cur(); return json(res, 200, {active: (e.LLM_PROVIDER || 'ollama').toLowerCase(), providers: Object.entries(KEY).map(([id, [k, mk]]) => ({id, keySet: !!e[k], model: e[mk] ?? ''}))}); }
      const b = await body(req, LlmProviderBody), id = b.provider;
      if (p[1] === 'test' && m === 'POST') return json(res, 200, await testProvider(id, cur() as NodeJS.ProcessEnv));
      if (p[1] === 'providers' && m === 'PUT') {
        const upd: Record<string, string> = {};
        if (id !== 'ollama') {
          const [k, mk] = KEY[id] ?? [];
          if (!k) throw new HttpError(422, 'Unknown provider.');
          if (b.key?.trim()) upd[k] = b.key.trim();
          if (typeof b.model === 'string') upd[mk] = b.model.trim();
        }
        if (b.active === true) { if (id !== 'ollama' && !(upd[KEY[id][0]] || cur()[KEY[id][0]])) throw new HttpError(422, 'Save a key first.'); upd.LLM_PROVIDER = id; }
        else if (b.active === false && (cur().LLM_PROVIDER || 'ollama') === id) upd.LLM_PROVIDER = 'ollama';
        writeEnv(upd); return json(res, 200, {ok: true});
      }
    }
    if (p[0] === 'llm' && !p[2]) {
      if (p[1] === 'setup' && m === 'POST') { void ensureOllama().catch(() => {}); await new Promise(r => setTimeout(r, 50)); }
      else if (p[1] || m !== 'GET') throw new HttpError(404, 'Not found.');
      const reachable = await ollamaReachable();
      let models: string[] = [];
      if (reachable) try { models = ((await (await fetch(`${process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'}/api/tags`)).json()) as any).models.map((x: any) => x.name); } catch { /* ignore */ }
      return json(res, 200, {...llmSetupState(), reachable, models, chosen: pickModel(models, process.env.OLLAMA_MODEL?.trim() || undefined)});
    }
    if (p[0] === 'stock') { // licensed b-roll: Pixabay key (saved to .env, never echoed back) and a test call
      const key = () => readEnv().PIXABAY_API_KEY || process.env.PIXABAY_API_KEY || '';
      if (p[1] === 'status' && m === 'GET') return json(res, 200, {pixabay: !!key(), keyless: ['openverse', 'wikimedia']});
      if (p[1] === 'key' && m === 'PUT') {
        const b = await body(req, StockKeyBody), k = String(b.key ?? '').trim();
        if (!/^[A-Za-z0-9-]{10,80}$/.test(k)) throw new HttpError(422, 'That does not look like a Pixabay key (letters, digits and dashes).');
        writeEnv({PIXABAY_API_KEY: k}); return json(res, 200, {ok: true});
      }
      if (p[1] === 'test' && m === 'POST') { const k = key(); return json(res, 200, k ? await testPixabayKey(k) : {ok: false, message: 'No key saved yet.'}); }
    }
    if (p[0] === 'settings') {
      if (m === 'GET') { const e = readEnv(); return json(res, 200, {elevenKeySet: !!(e.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY), voiceId: e.ELEVENLABS_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID ?? '', model: e.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2', engine: e.STUDIO_ENGINE ?? 'auto', ffmpeg: await has('ffmpeg'), draftInstalled: draftInstalled(), ideasInstalled: scriptInstalled('ideas'), publishInstalled: scriptInstalled('publish-pack')}); }
      if (m === 'PUT') {
        const b = await body(req, SettingsBody); const upd: Record<string, string> = {};
        if (typeof b.apiKey === 'string' && b.apiKey.trim()) upd.ELEVENLABS_API_KEY = b.apiKey.trim();
        if (typeof b.llmModel === 'string') upd.OLLAMA_MODEL = b.llmModel.trim();
        if (typeof b.voiceId === 'string') upd.ELEVENLABS_VOICE_ID = b.voiceId.trim();
        if (typeof b.model === 'string') upd.ELEVENLABS_MODEL = b.model.trim();
        if (typeof b.engine === 'string') upd.STUDIO_ENGINE = b.engine;
        writeEnv(upd); return json(res, 200, {ok: true});
      }
    }
    json(res, 404, {error: 'Not found.'});
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.code, {error: friendlyError(e.message)});
    logLine(ROOT, 'api-500', `${m} ${url.pathname}: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    json(res, 500, {error: friendlyError(e instanceof Error ? e.message : String(e))});
  }
}
const has = (bin: string) => new Promise<boolean>(ok => { const c = spawn(bin, ['-version']); c.on('error', () => ok(false)); c.on('close', code => ok(code === 0)); });

// ---------- server + vite ----------
const vite = await createVite({
  root: `${ROOT}studio/web`, configFile: false, plugins: [react()],
  server: {middlewareMode: true}, appType: 'spa',
});
const server = http.createServer((req, res) => {
  const bad = checkRequest({host: req.headers.host, origin: req.headers.origin, method: req.method, url: req.url, contentType: req.headers['content-type'], contentLength: req.headers['content-length']}, PORT);
  if (bad) { res.writeHead(bad.code, {'Content-Type': 'text/plain'}); return void res.end(bad.msg); }
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return void api(req, res, url);
  vite.middlewares(req, res);
});
process.on('uncaughtException', e => logLine(ROOT, 'uncaught', e.stack ?? String(e)));
process.on('unhandledRejection', e => logLine(ROOT, 'unhandled', String(e instanceof Error ? e.stack : e)));
ensureDefaultChannel();
loadJobs(); pump();
server.listen(PORT, '127.0.0.1', () => { console.log(`Mascot Engine Studio: http://localhost:${PORT}`); if (!process.env.STUDIO_TEST) void ensureOllama().catch(e => console.log(`Local AI: ${(e as Error).message}`)); });
