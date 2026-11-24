import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {Episode, type Scene} from '../schema.js';
import {MODEL} from '../draft/draft.js';
import {NO_PROVIDER, extractJson, type Client} from '../llm/llm.js';
import type {Channel} from '../channel/channel.js';

export {MODEL};

export type Chapter = {startSec: number; title: string};
export type Pack = {
  titles: string[]; description: string; tags: string[]; chapters: Chapter[];
  thumbnailText: string[]; source: 'ai' | 'fallback';
  uploadNotes?: string[]; // manual YouTube Studio steps (AI disclosure etc.)
  category?: {id: number; name: string}; // YouTube video category (Studio > Details > Show more)
  pinnedComment?: string; // post and pin right after publishing
};
export type SceneTiming = {index: number; startSec: number};

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

const LEAD = /^(why|how|what|when|is|are|does|do|can|should)\s+/i;
const TRAIL_STOP = new Set(['of','to','in','on','at','for','and','the','a','an','by','with','vs','is','are']);
const upFirst = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** Strip units, digits, parentheses and dangling connector words so a title reads like a human wrote it. */
function tidy(x: string, maxWords = 5): string {
  const w = x.replace(/\([^)]*\)/g, ' ').replace(/[$%€£#]|\d[\d.,]*/g, ' ').replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, maxWords);
  while (w.length && TRAIL_STOP.has(w[w.length - 1].toLowerCase())) w.pop();
  return upFirst(w.join(' '));
}

/** Short form of the episode title: drop the leading question word, "your" and -ly adverbs. */
export function shortTitle(title: string): string {
  const w = title.replace(LEAD, '').split(/\s+/).filter(x => !/^your$/i.test(x) && !/^\w{4,}ly$/i.test(x));
  return tidy(w.join(' '), 5) || tidy(title, 5);
}

function sceneLabel(s: Scene, epTitle: string): string {
  const talkish = () => tidy(s.emphasis.find(e => tidy(e)) ?? s.narration.split(/[.!?]/)[0], 5);
  switch (s.type) {
    case 'title': return shortTitle(epTitle);
    case 'big_number': return tidy(s.label.split(/\b(?:after|at|over|in|for|by|from)\b/i)[0]) || tidy(s.label) || talkish();
    case 'chart': { const t = tidy(s.chart.yLabel, 4); return t ? `${t} over time` : 'The numbers over time'; }
    case 'compare': return `${tidy(s.left.title, 4)} vs ${tidy(s.right.title, 4)}`;
    case 'list': { const t = tidy(s.items[0].split(/\b(?:for|to|in|of|when|if)\b/i)[0], 4); return t ? `What to do: ${t}` : 'What to do'; }
    default: return talkish() || 'Next up';
  }
}

export const MIN_CHAPTER_SEC = 10;

/** YouTube rules: first at 0:00, at least 3 chapters, each at least 10s. Returns [] if the video cannot satisfy them. */
export function buildChapters(scenes: Scene[], timings: SceneTiming[], totalSec: number, epTitle = ''): Chapter[] {
  const t = [...timings].sort((a, b) => a.index - b.index);
  if (!t.length) return [];
  const starts: number[] = [0];
  for (const x of t.slice(1)) {
    const prev = starts[starts.length - 1];
    if (x.startSec - prev >= MIN_CHAPTER_SEC && totalSec - x.startSec >= MIN_CHAPTER_SEC) starts.push(x.startSec);
  }
  if (starts.length < 3) return [];
  return starts.map((startSec, n) => {
    if (n === 0) return {startSec: 0, title: scenes[0]?.type === 'title' && epTitle ? shortTitle(epTitle) : 'Intro'};
    const timing = t.find(x => x.startSec === startSec)!;
    const sc = scenes[timing.index];
    return {startSec: Math.floor(startSec), title: sc ? sceneLabel(sc, epTitle) : `Part ${n + 1}`};
  });
}

export function fmtTime(sec: number): string {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

export const DISCLAIMER = 'This video is for educational purposes only and is not financial advice.';
export const AI_DISCLOSURE = 'Altered or synthetic content: the narration uses an AI-generated voice and the visuals are computer-generated.';

export function buildDescription(ep: Episode, chapters: Chapter[]): string {
  const parts: string[] = [ep.scenes[0].narration.trim()];
  if (chapters.length) parts.push(chapters.map(c => `${fmtTime(c.startSec)} ${c.title}`).join('\n'));
  if (ep.sources.length) parts.push('Sources:\n' + ep.sources.map((u, i) => `${i + 1}. ${u}`).join('\n'));
  if (ep.disclaimer) parts.push(DISCLAIMER);
  parts.push(AI_DISCLOSURE);
  return parts.join('\n\n');
}

const STOP = new Set(['after','over','years','year','quietly','really','just','about','from','that','this','with','into','been','have','has','will','can','not','but','so','then','than','their','they','it','its','as','at','by','be','or','the','a','an','is','are','your','you','why','how','what','of','to','in','on','and','for','my','our','does','do','are','is']);
const words = (x: string) => x.replace(/[^\w\s$%]/g, '').split(/\s+/).filter(Boolean);
const cap = (x: string) => x.replace(/\b\w/g, c => c.toUpperCase());

/** 3 offline thumbnail options (max 4 words each), built from real content. */
export function fallbackThumbs(ep: Episode): string[] {
  const out: string[] = [];
  const bn = ep.scenes.find(s => s.type === 'big_number');
  if (bn && bn.type === 'big_number') {
    const n = `${bn.prefix}${bn.value.toLocaleString('en-US', {maximumFractionDigits: bn.decimals})}${bn.suffix}`;
    const label = words(bn.label).filter(w => !STOP.has(w.toLowerCase()) && !/[\d$%]/.test(w)).slice(0, 2).join(' ');
    out.push(cap(`${n} ${label}`.trim()));
  }
  const emph = ep.scenes.flatMap(s => s.emphasis).find(e => words(e).length >= 1 && words(e).length <= 4);
  if (emph) out.push(cap(words(emph).join(' ')));
  const key = words(ep.title).filter(w => !STOP.has(w.toLowerCase()))[0];
  out.push(key ? `${cap(key)}: Fact Or Myth?` : 'Fact Or Myth?');
  for (const f of ['The Maths', 'Explained']) if (out.length < 3 && !out.includes(f)) out.push(f);
  return out.slice(0, 3);
}

const isKeyword = (w: string) => w.length > 2 && !STOP.has(w.toLowerCase()) && !/^\w{4,}ly$/i.test(w) && !/[\d$%]/.test(w);

/** Niche tags plus 2-3 word phrases from title, emphasis and sources; stopwords dropped; max 15 tags, <450 chars. */
export function fallbackTags(ep: Episode): string[] {
  const phrases: string[] = [];
  const runs = (text: string) => {
    const k = words(text).filter(isKeyword).map(w => w.toLowerCase());
    if (k.length >= 2) phrases.push(k.slice(0, 3).join(' '));
  };
  runs(ep.title);
  ep.scenes.flatMap(s => s.emphasis).forEach(runs);
  const bn = ep.scenes.find(s => s.type === 'big_number');
  if (bn && bn.type === 'big_number') runs(bn.label);
  const hosts = ep.sources.map(u => { try { return new URL(u).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } }).filter(h => h.length > 2 && h.length <= 6); // short agency names (bls, fred), not 'investor'
  const freq = (w: string) => (ep.scenes.map(x => x.narration).join(' ').toLowerCase().match(new RegExp(`\\b${w}\\b`, 'g')) ?? []).length;
  const single = words(ep.title).filter(isKeyword).map(w => w.toLowerCase()).filter((w, i) => i === 0 || (w.length >= 5 && freq(w) >= 2)); // one-word tags only if the video really repeats them
  const topic = single[0];
  const cand = [ep.series.replace(/-/g, ' '), 'personal finance', ...phrases,
    ...(topic ? [`${topic} explained`] : []), ...single, 'money basics', ...hosts];
  const out: string[] = [];
  let len = 0;
  for (const c of cand) {
    if (!c || out.includes(c) || out.length >= 15 || len + c.length + 1 > 440) continue;
    out.push(c); len += c.length + 1;
  }
  return out;
}

export type Kind = 'finance' | 'tech' | 'history' | 'generic';
/** Channel family from its niche text (the presets: finance, tech, history). */
export const kindOf = (niche = ''): Kind => /finance|money|invest|saving|econom/i.test(niche) ? 'finance' : /tech|software|computer|gadget|\bai\b|internet/i.test(niche) ? 'tech' : /histor|ancient|empire|\bwar\b/i.test(niche) ? 'history' : 'generic';
const CATEGORY: Record<Kind, {id: number; name: string}> = {finance: {id: 27, name: 'Education'}, tech: {id: 28, name: 'Science & Technology'}, history: {id: 27, name: 'Education'}, generic: {id: 27, name: 'Education'}};
export const categoryFor = (k: Kind) => CATEGORY[k];

/** Title endings per channel voice: dry maths for finance, "how it works" for tech, story framing for history. */
const TITLE_TONE: Record<Kind, {pre?: (t: string) => string; post: string[]}> = {
  finance: {post: ['the maths', 'what the numbers say', 'in plain English']},
  tech: {pre: t => `How it works: ${t}`, post: ['explained simply', 'what is really happening', 'the simple version']},
  history: {pre: t => `What really happened: ${t}`, post: ['the real story', 'myth versus evidence', 'what the sources say']},
  generic: {post: ['explained', 'the short version', 'in plain English']},
};

/** Pinned-comment text: one question that invites replies, where the sources are, and the finance disclaimer when it applies. */
export function pinnedComment(ep: Episode, kind: Kind): string {
  const q: Record<Kind, string> = {
    finance: 'Which number in this video surprised you most? Tell us below, and what myth should we check next?',
    tech: 'Which part of this did you not know how it worked? Tell us below, and what should we explain next?',
    history: 'Which part of this story did you hear differently before? Tell us below, and which period should we cover next?',
    generic: 'What surprised you most in this video? Tell us below, and what should we cover next?',
  };
  return [q[kind], ep.sources.length ? 'Sources are listed in the description.' : '', kind === 'finance' && ep.disclaimer ? DISCLAIMER : ''].filter(Boolean).join('\n\n');
}

export function fallbackMeta(ep: Episode, totalSec = 0, kind: Kind = 'finance'): Pick<Pack, 'titles' | 'tags' | 'thumbnailText'> {
  const t = ep.title.trim().replace(/[.?!]+$/, '');
  const short = shortTitle(ep.title);
  const bn = ep.scenes.find(s => s.type === 'big_number');
  const num = bn && bn.type === 'big_number' ? `${bn.prefix}${bn.value.toLocaleString('en-US', {maximumFractionDigits: bn.decimals})}${bn.suffix}` : '';
  const mins = Math.max(1, Math.round(totalSec / 60));
  const tone = TITLE_TONE[kind];
  const cand = [ep.title.trim(), ...(tone.pre ? [tone.pre(t)] : []),
    ...(num && bn?.type === 'big_number' && !/\d/.test(bn.label) ? [`${num} ${bn.label.replace(/\s+/g, ' ').trim().toLowerCase()}: the maths step by step`] : []),
    ...(totalSec >= 90 ? [`${short || t} explained in ${mins} minute${mins > 1 ? 's' : ''}`] : []),
    ...tone.post.map(x => `${short || t}: ${x}`), ...tone.post.map(x => `${t}: ${x}`)];
  const titles = [...new Set(cand.map(x => clip(upFirst(x), 100)))].slice(0, 5);
  return {titles, tags: fallbackTags(ep), thumbnailText: fallbackThumbs(ep)};
}

/** YouTube limits: title <= 100 (<= 70 reads fully on mobile), description <= 5000 bytes, no < >, tags <= 500 chars total and <= 30 each, chapters 0:00 / >= 3 / >= 10 s. */
export function validatePack(p: Pick<Pack, 'titles' | 'description' | 'tags' | 'chapters'>): string[] {
  const out: string[] = [];
  p.titles.forEach((t, i) => { if (t.length > 100) out.push(`title ${i + 1} is ${t.length} chars (max 100)`); else if (t.length > 70) out.push(`title ${i + 1} is ${t.length} chars (cut off after ~70 on mobile)`); if (/[<>]/.test(t)) out.push(`title ${i + 1} contains < or >`); });
  if (Buffer.byteLength(p.description) > 5000) out.push(`description is ${Buffer.byteLength(p.description)} bytes (max 5000)`);
  if (/[<>]/.test(p.description)) out.push('description contains < or > (YouTube rejects them)');
  if (p.tags.join(',').length > 500) out.push('tags exceed 500 characters');
  if ('pinnedComment' in p && typeof (p as {pinnedComment?: string}).pinnedComment === 'string' && (p as {pinnedComment: string}).pinnedComment.length > 500) out.push('pinned comment is over 500 characters (long pinned comments get collapsed)');
  p.tags.filter(t => t.length > 30).forEach(t => out.push(`tag "${t}" is over 30 chars`));
  const ch = p.chapters;
  if (ch.length) {
    if (ch[0].startSec !== 0) out.push('first chapter must start at 0:00');
    if (ch.length < 3) out.push('need at least 3 chapters');
    ch.forEach((c, i) => { if (i && c.startSec - ch[i - 1].startSec < MIN_CHAPTER_SEC) out.push(`chapter ${i} is shorter than ${MIN_CHAPTER_SEC}s`); if (!c.title.trim()) out.push(`chapter ${i + 1} has no title`); });
  }
  return out;
}

/** Make a pack safe to paste: strip angle brackets, drop over-long tags, trim description at a line break. */
export function fixPack(p: Pack): Pack {
  const strip = (x: string) => x.replace(/[<>]/g, '');
  let description = strip(p.description);
  while (Buffer.byteLength(description) > 5000) description = description.slice(0, description.lastIndexOf('\n\n')).trimEnd();
  const tags: string[] = [];
  for (const t of p.tags.filter(x => x.length <= 30)) if ([...tags, t].join(',').length <= 500) tags.push(t);
  return {...p, titles: p.titles.map(t => clip(strip(t), 100)), description, tags};
}

export const UPLOAD_NOTES = [
  'YouTube Studio > Details > "Altered content": answer Yes if the voice or any scene could be mistaken for a real person or real event. This channel uses a synthetic (AI/text-to-speech) narrator and cartoon visuals; Google lets purely animated or obviously unrealistic content answer No, but when unsure answer Yes. The description already says the narration is AI-generated.',
  'Keep the disclosure line in the description; do not remove it before publishing.',
  'Financial content: the educational disclaimer is in the description and the end card; do not add return guarantees to the title or thumbnail.',
];

const BANNED = [/guarantee/i, /risk[- ]free/i, /can'?t lose/i, /get rich/i, /you should (buy|sell|invest)/i, /won'?t believe/i, /shocking/i, /secret/i, /nobody tells/i, /millionaire in/i];

const Meta = z.object({
  titles: z.array(z.string().min(3).max(100)).length(5),
  tags: z.array(z.string().min(1)).min(3).max(25),
  thumbnailText: z.array(z.string().min(1)).length(3),
}).superRefine((m, ctx) => {
  m.thumbnailText.forEach((t, i) => {
    if (t.trim().split(/\s+/).length > 4) ctx.addIssue({code: 'custom', message: `thumbnailText.${i}: more than 4 words`});
  });
  [...m.titles, ...m.thumbnailText].forEach(t => {
    const re = BANNED.find(r => r.test(t));
    if (re) ctx.addIssue({code: 'custom', message: `"${t}" uses banned wording (${re})`});
  });
  if (m.tags.join(',').length > 500) ctx.addIssue({code: 'custom', message: 'tags exceed 500 characters total'});
});

export function buildSystem(channel?: Channel): string {
  const voice = channel ? `Channel: ${channel.name} (${channel.niche}). Audience: ${channel.audience}. Voice: ${channel.tone}${channel.bannedTopics.length ? ` Never touch: ${channel.bannedTopics.join(', ')}.` : ''}` : 'Channel: educational explainers. Tone: casual, dry, no hype.';
  return `You write YouTube packaging for an educational explainer channel. ${voice} Titles are specific and honest: no clickbait, no fear-baiting, no guarantees, no advice ("you should buy"), max 100 characters. thumbnailText options have at most 4 words each.
Output ONLY one JSON object (no prose, no code fences): {"titles": [5 strings], "tags": [5-15 strings], "thumbnailText": [3 strings]}`;
}

export function buildUser(ep: Episode): string {
  return `Episode title: ${ep.title}\nHook: ${ep.scenes[0].narration}\nScenes:\n${ep.scenes.map((s, i) => `${i + 1}. [${s.type}] ${s.narration}`).join('\n')}`;
}

export async function aiMeta(client: Client, ep: Episode, model = MODEL, channel?: Channel): Promise<z.infer<typeof Meta>> {
  const messages: Array<{role: 'user' | 'assistant'; content: string}> = [{role: 'user', content: buildUser(ep)}];
  let errors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({model, max_tokens: 2000, system: buildSystem(channel), messages});
    const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    try {
      const r = Meta.safeParse(extractJson(text));
      if (r.success) return r.data;
      errors = r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    } catch (e) { errors = [`Output is not valid JSON: ${(e as Error).message}`]; }
    messages.push({role: 'assistant', content: text}, {role: 'user', content: `Validation failed. Fix and output the full JSON only:\n- ${errors.join('\n- ')}`});
  }
  throw new Error(`Publish metadata failed validation after retry:\n- ${errors.join('\n- ')}`);
}

export async function buildPack(o: {
  ep: Episode; timings: SceneTiming[]; totalSec: number; client?: Client; model?: string; warn?: (m: string) => void; channel?: Channel;
}): Promise<Pack> {
  const kind = kindOf(o.channel?.niche);
  const warn = o.warn ?? console.error;
  const chapters = buildChapters(o.ep.scenes, o.timings, o.totalSec, o.ep.title);
  if (!chapters.length) warn('Warning: video too short for YouTube chapters (need 3 chapters of 10s+); chapters omitted.');
  const description = buildDescription(o.ep, chapters);
  let meta: Pick<Pack, 'titles' | 'tags' | 'thumbnailText'> = fallbackMeta(o.ep, o.totalSec, kind);
  let source: Pack['source'] = 'fallback';
  if (o.client) {
    try { meta = await aiMeta(o.client, o.ep, o.model, o.channel); source = 'ai'; }
    catch (e) { warn(`AI metadata failed, using fallback: ${(e as Error).message}`); }
  } else warn(`${NO_PROVIDER} Using offline fallback titles.`);
  const pack = fixPack({...meta, description, chapters, source, uploadNotes: [...UPLOAD_NOTES, 'After publishing, post the text in pinnedComment as the first comment and pin it (Studio > Comments > three dots > Pin).', `Category: ${categoryFor(kind).name} (Studio > Details > Show more).`], category: categoryFor(kind), pinnedComment: pinnedComment(o.ep, kind)});
  validatePack(pack).forEach(m => warn(`Publish pack: ${m}`));
  return pack;
}

export function loadEpisodeFile(root: string, id: string): {ep: Episode; dir: string} {
  const dir = path.join(root, 'episodes', id);
  const f = path.join(dir, 'episode.json');
  if (!fs.existsSync(f)) throw new Error(`Episode not found: ${id}`);
  return {ep: Episode.parse(JSON.parse(fs.readFileSync(f, 'utf8'))), dir};
}

export function loadTimings(dir: string): {timings: SceneTiming[]; totalSec: number} {
  const f = path.join(dir, 'build', 'decisions.json');
  if (!fs.existsSync(f)) throw new Error(`Missing ${f}; run the build first.`);
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  return {timings: d.scenes.map((s: any) => ({index: s.index, startSec: s.startSec})), totalSec: d.totalSec};
}

export function writePack(dir: string, pack: Pack): string {
  const file = path.join(dir, 'build', 'publish.json');
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
  return file;
}
