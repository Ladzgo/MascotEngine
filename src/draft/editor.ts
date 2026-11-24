import type {Episode} from '../schema.js';
import {extractJson, type Client} from '../llm/llm.js';
import {isHu} from './lang.js';
import {lintEpisode, autoFixEpisode} from './lint.js';

type Sc = Episode['scenes'][number];
const digits = (t: string) => (t.match(/\d[\d,.]*/g) ?? []).join('|');

/**
 * Deterministic clean-up of what small models get wrong most often (no model call). Safe on any language; Hungarian number format only when `hu`.
 * Collapses doubled words ("a a"), stray spaces before punctuation, repeated identical sentences inside one line, and with hu writes
 * 1,234,567 / 1.234.567 as "1 234 567" and 3.5 as "3,5".
 */
export function huFix(text: string, hu = true): string {
  let t = text.replace(/\s+([,.!?;:])/g, '$1').replace(/\s{2,}/g, ' ');
  t = t.replace(/(?<![\p{L}\d])(\p{L}{1,}) \1(?![\p{L}\d])/giu, '$1'); // "a a", "hogy hogy"
  const seen = new Set<string>();
  t = (t.match(/[^.!?]+[.!?]*\s*/g) ?? [t]).filter(s => { const k = s.trim().toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }).join('').trim();
  if (hu) {
    t = t.replace(/\d{1,3}(?:[,.]\d{3})+(?!\d)/g, m => m.replace(/[,.]/g, ' ')); // thousands: 1,234,567 -> 1 234 567
    t = t.replace(/(\d)\.(\d{1,2})(?!\d)/g, '$1,$2'); // decimals: 3.5 -> 3,5
  }
  return t;
}

/** Same numbers after huFix? (the formatting changes separators only: compare digit runs.) */
const digitRuns = (t: string) => (t.match(/\d+/g) ?? []).join('|');

/** Deterministic fixers over the whole episode (hook rules still apply: the fixer never lengthens a line). */
export const fixEpisode = (ep: Episode, lang?: string): Episode => ({...ep, scenes: ep.scenes.map(s => { const n = huFix(s.narration, isHu(lang)); return digitRuns(n) === digitRuns(s.narration) && n ? {...s, narration: n} : s; }) as Episode['scenes']});

/**
 * "Editor" second pass for small local models: one narrow call per scene fixes grammar, word forms and invented words, keeping meaning, numbers and length.
 * A rewrite is kept only if the digits are identical, the length stays within 60-140%, and it passes the banned-wording lint; otherwise the line is left as it was.
 */
export async function editPass(client: Client, ep: Episode, o: {model?: string; lang?: string; log?: (m: string) => void} = {}): Promise<{ep: Episode; changed: number; tried: number}> {
  const lang = isHu(o.lang) ? 'Hungarian' : 'the same language as the line';
  const scenes = [...ep.scenes];
  let changed = 0, tried = 0;
  for (const [i, s] of scenes.entries()) {
    if (i === 0) continue; // the hook has its own pass and a 15 word limit
    tried++;
    try {
      const res = await client.messages.create({model: o.model ?? 'claude-sonnet-5-5', max_tokens: 400,
        system: `You are a careful copy editor for ${lang}. Fix grammar, word forms, spelling and any invented or non-existent words in ONE line of video narration. Keep the meaning, every number and about the same length. Do not add facts, advice or new numbers. Output ONLY JSON: {"narration": string}. If the line is already correct, return it unchanged.`,
        messages: [{role: 'user', content: `Previous line: ${scenes[i - 1].narration}\nLine to fix: ${s.narration}`}]});
      const cand = String((extractJson(res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('')) as {narration?: unknown}).narration ?? '').trim();
      const ratio = cand.length / Math.max(1, s.narration.length);
      if (!cand || cand === s.narration) continue;
      const probe = autoFixEpisode({...ep, scenes: [{...s, narration: 'x'}, {...s, narration: cand}] as Episode['scenes']}).scenes[1].narration;
      if (digits(cand) !== digits(s.narration) || ratio < 0.6 || ratio > 1.4 || probe !== cand || lintEpisode({...ep, scenes: [ep.scenes[0], {...s, narration: cand}] as Episode['scenes']}).some(e => /banned/.test(e))) { o.log?.(`edit: kept scene ${i + 1} as is`); continue; }
      scenes[i] = {...s, narration: cand} as Sc; changed++;
    } catch { /* keep the line */ }
  }
  return {ep: {...ep, scenes: scenes as Episode['scenes']}, changed, tried};
}
