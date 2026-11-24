import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {MODEL} from '../draft/draft.js';
import {NO_PROVIDER, extractJson, type Client} from '../llm/llm.js';
import {channelContext, channelDir, type Channel} from '../channel/channel.js';

export {MODEL};
export const MISSING_KEY = NO_PROVIDER;

export type ChannelInfo = Channel;

export const Format = z.enum(['explainer', 'myth_vs_fact', 'story', 'how_to', 'comparison']);
export const Idea = z.object({
  id: z.string(), title: z.string().min(3), angle: z.string().min(3), hook: z.string().min(3),
  whyInteresting: z.string().min(3), format: Format,
  difficulty: z.number().int().min(1).max(3),
  needsSources: z.array(z.string()).default([]),
  status: z.enum(['new', 'drafted', 'dismissed']).default('new'),
  episodeId: z.string().optional(), createdAt: z.string(),
});
export type Idea = z.infer<typeof Idea>;
export type IdeasFile = {generatedAt: string; ideas: Idea[]};

export function slug(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'idea';
}

const ADVICE = [/guarantee/i, /risk[- ]free/i, /can'?t lose/i, /get rich/i, /you should (buy|sell|invest)/i, /sure thing/i, /will (double|triple)/i];

export function buildSystem(ch: ChannelInfo): string {
  return `You generate video ideas for a YouTube channel.
${channelContext(ch)}

Rules: ideas must be specific (one concrete claim, number or situation, not a broad subject), surprising, and non-clickbait (no "you won't believe", no fear-baiting). Each has a clear opinion/angle. No guaranteed-returns or advice claims, never tell viewers what to buy, sell or hold. Every idea must be checkable: list what facts must be verified in needsSources. Do not repeat or lightly reword the titles listed as already used, and do not reuse their core claim in a new wrapper. Vary the formats across the batch; about a third of the titles should contain a concrete number, amount or timeframe; never write generic titles like "Everything you need to know about X".

Output ONLY one JSON object (no prose, no code fences):
{"ideas": [{"title": string, "angle": string (the opinion/take), "hook": string (first spoken sentence, 15 words max), "whyInteresting": string (1-2 lines: curiosity gap, stakes, timeliness), "format": "explainer"|"myth_vs_fact"|"story"|"how_to"|"comparison", "difficulty": 1|2|3 (production effort), "needsSources": [string]}]}`;
}

export function buildUser(count: number, used: string[], focus?: string): string {
  return `Generate ${count} ideas.${focus ? `\nFocus: ${focus}` : ''}\nAlready used titles (avoid):\n${used.length ? used.map(t => `- ${t}`).join('\n') : '(none)'}`;
}

const STOPW = new Set(['the', 'and', 'for', 'why', 'how', 'what', 'your', 'you', 'are', 'is', 'to', 'of', 'in', 'on', 'a', 'an', 'do', 'does', 'really', 'actually']);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOPW.has(w)).map(stem);
function similar(a: string, b: string): boolean {
  const x = new Set(norm(a)), y = new Set(norm(b));
  if (!x.size || !y.size) return false;
  let inter = 0; x.forEach(w => { if (y.has(w)) inter++; });
  return inter / (x.size + y.size - inter) >= 0.6 || (inter >= 3 && inter / Math.min(x.size, y.size) >= 0.8); // second clause: a short title contained in a longer one
}

const VAGUE = /^(everything|all about|the truth about|introduction to|a guide to|guide to|understanding|the basics of|money tips|things you)\b/i;
const CLICKBAIT = /\b(shocking|won'?t believe|secret|nobody tells|they don'?t want|insane|destroy|exposed)\b/i;

/** Specificity score: numbers and a real claim up, vague/clickbait titles down. < 0 is dropped as too vague. */
export function specificity(i: Pick<Idea, 'title' | 'needsSources'>): number {
  const words = i.title.trim().split(/\s+/).length;
  let s = 0;
  if (/[\d$%]/.test(i.title)) s += 2;
  if (words >= 5 && words <= 12) s += 1; else if (words <= 3) s -= 3; else if (words > 16) s -= 1;
  if (VAGUE.test(i.title.trim())) s -= 3;
  if (CLICKBAIT.test(i.title)) s -= 2;
  if (i.needsSources.length) s += 1;
  return s;
}

export function lintIdeas(ideas: Idea[], o: {banned: string[]; used: string[]}): {kept: Idea[]; dropped: string[]} {
  const kept: Idea[] = [], dropped: string[] = [];
  const seen = [...o.used];
  for (const i of ideas) {
    const text = `${i.title} ${i.angle} ${i.hook}`;
    const ban = o.banned.find(b => b.trim() && text.toLowerCase().includes(b.trim().toLowerCase()));
    if (ban) { dropped.push(`${i.title}: banned topic "${ban}"`); continue; }
    if (ADVICE.some(re => re.test(text))) { dropped.push(`${i.title}: guarantee/advice wording`); continue; }
    if (specificity(i) < 0) { dropped.push(`${i.title}: too vague or clickbait`); continue; }
    if (seen.some(t => similar(t, i.title))) { dropped.push(`${i.title}: duplicate`); continue; }
    seen.push(i.title); kept.push(i);
  }
  return {kept: kept.map((i, n) => ({i, n})).sort((a, b) => specificity(b.i) - specificity(a.i) || a.n - b.n).map(x => x.i), dropped};
}

function parse(text: string, now: string): {ideas?: Idea[]; errors: string[]} {
  let raw: any;
  try { raw = extractJson(text); } catch (e) { return {errors: [`Output is not valid JSON: ${(e as Error).message}`]}; }
  if (!raw || !Array.isArray(raw.ideas) || !raw.ideas.length) return {errors: ['Expected {"ideas": [...]} with at least one idea.']};
  const errors: string[] = [], ideas: Idea[] = [];
  raw.ideas.forEach((r: any, n: number) => {
    const res = Idea.safeParse({...r, id: slug(String(r?.title ?? '')), status: 'new', createdAt: now});
    if (res.success) ideas.push(res.data);
    else errors.push(...res.error.issues.map(i => `ideas.${n}.${i.path.join('.')}: ${i.message}`));
  });
  return errors.length ? {errors} : {ideas, errors};
}

export async function generateIdeas(o: {
  client: Client; channel: ChannelInfo; count: number; focus?: string; used: string[]; model?: string; now?: string;
}): Promise<{ideas: Idea[]; dropped: string[]}> {
  const now = o.now ?? new Date().toISOString();
  const system = buildSystem(o.channel);
  const messages: Array<{role: 'user' | 'assistant'; content: string}> = [{role: 'user', content: buildUser(o.count, o.used, o.focus)}];
  let last: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 6000, system, messages});
    const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    const {ideas, errors} = parse(text, now);
    if (ideas) {
      let {kept, dropped} = lintIdeas(ideas, {banned: o.channel.bannedTopics, used: o.used});
      // small local models repeat themselves: one top-up call for the missing ones, told what was already taken or rejected
      if (kept.length < o.count) {
        try {
          const avoid = [...o.used, ...kept.map(k => k.title), ...ideas.map(x => x.title)];
          const r2 = await o.client.messages.create({model: o.model ?? MODEL, max_tokens: 6000, system, messages: [{role: 'user', content: buildUser(o.count - kept.length, avoid, [o.focus, 'Pick clearly different subtopics from everything listed.'].filter(Boolean).join('\n'))}]});
          const p2 = parse(r2.content.filter(c => c.type === 'text').map(c => c.text ?? '').join(''), now);
          if (p2.ideas) { const l2 = lintIdeas(p2.ideas, {banned: o.channel.bannedTopics, used: [...o.used, ...kept.map(k => k.title)]}); kept = lintIdeas([...kept, ...l2.kept], {banned: [], used: []}).kept; dropped = [...dropped, ...l2.dropped]; }
        } catch { /* keep what we have */ }
      }
      return {ideas: kept.slice(0, o.count), dropped};
    }
    last = errors;
    messages.push({role: 'assistant', content: text}, {
      role: 'user', content: `The JSON failed validation. Fix these errors and output the full corrected JSON only:\n- ${errors.join('\n- ')}`,
    });
  }
  throw new Error(`Ideas failed validation after retry:\n- ${last.join('\n- ')}`);
}

export function ideasPath(id: string) { return path.join(channelDir(id), 'ideas.json'); }

export function readIdeas(file: string): IdeasFile {
  if (!fs.existsSync(file)) return {generatedAt: '', ideas: []};
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {generatedAt: raw.generatedAt ?? '', ideas: z.array(Idea).parse(raw.ideas ?? [])};
}

export function mergeIdeas(existing: IdeasFile, fresh: Idea[], now: string): IdeasFile {
  const ids = new Set(existing.ideas.map(i => i.id));
  const add = fresh.filter(i => !ids.has(i.id));
  return {generatedAt: now, ideas: [...existing.ideas, ...add]};
}

export function writeIdeas(file: string, data: IdeasFile) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** Titles of existing episodes in this channel (episode.channel defaults to 'default'). */
export function episodeTitles(root: string, channelId: string): string[] {
  const dir = path.join(root, 'episodes');
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const d of fs.readdirSync(dir)) {
    const f = path.join(dir, d, 'episode.json');
    if (!fs.existsSync(f)) continue;
    try {
      const e = JSON.parse(fs.readFileSync(f, 'utf8'));
      if ((e.channel ?? 'default') === channelId && e.title) out.push(String(e.title));
    } catch { /* skip unreadable */ }
  }
  return out;
}
