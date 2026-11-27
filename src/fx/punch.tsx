import React from 'react';
import {DISPLAY, clamp, easeOut, spring} from '../theme';
import {isFunctionWord, type CaptionWord, type Phrase} from './captions';
import {numeralize} from '../pipeline/speech';

/** 'punch' caption preset: 2-3 words at a time, centred in the lower third, heavy white type with a black outline, current keyword yellow. */
const NUM = /^(\d[\d,.]*%?|\$\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|twenty-\w+)$/i;
const UNIT = /^(years?|months?|weeks?|days?|hours?|percent|dollars?|euros?|times|thousand|million|billion|hundred|cents?|%)$/i;
const bare = (w: string) => w.replace(/[^\w$%.,-]/g, '').replace(/[.,;:!?]+$/, '');
/** Words that must not end a caption chunk (the phrase would dangle: "EIGHTEEN YEARS TO"). */
const DANGLING = new Set('a an the of to in on at for and or but with as by from than then that this your their its is are was were be it you we they if so not no into over under about'.split(' '));
/** Words that open a new sense unit, so a cut right before them reads naturally ("A YEAR OF THEM | COSTS $1,825"). */
const STARTERS = new Set('the a an your my our their his her this these those to in on at for with from by into over under about and but or so because if when while than then who which until unless before after since'.split(' '));
/**
 * 'punch' preset chunks: 1-4 words per sense unit. Each clause (cut at punctuation) is split by a small cost search instead of
 * greedily taking 3 words: never between a number and its unit, never ending on a dangling function word, not before "of",
 * preferably right before a starter word, and single words or long chunks only when nothing better fits.
 */
const NUMV = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|point)$/;
/** Spoken number words (the aligner returns what TTS said) back to numerals for the captions: 'one thousand eight hundred twenty five dollars' -> one '$1,825' token
 *  spanning the same time (ep011: 'TWENTY FIVE DOLLARS' read as $25). Small counts stay words, as in the narration (numeralize decides). */
export function numeralWords(ws: CaptionWord[]): CaptionWord[] {
  const out: CaptionWord[] = [], low = (w: CaptionWord) => w.w.toLowerCase().replace(/[^a-z-]/g, '');
  for (let i = 0; i < ws.length; i++) {
    let j = i;
    const isNum = (x: CaptionWord | undefined) => !!x && low(x).split('-').every(y => NUMV.test(y));
    while (j < ws.length) {
      const ok = isNum(ws[j]) || (j > i && low(ws[j]) === 'and' && isNum(ws[j + 1])) || (j === i && low(ws[j]) === 'a' && isNum(ws[j + 1]));
      if (!ok) break;
      j++;
      if (/[.,;:!?]$/.test(ws[j - 1].w)) break; // a clause end closes the number
    }
    if (j > i && j < ws.length && /^(dollars?|percent)$/.test(low(ws[j])) && !/[.,;:!?]$/.test(ws[j - 1].w)) j++;
    if (j - i < 2) { out.push(ws[i]); continue; }
    const run = ws.slice(i, j), tail = /[.,;:!?]+$/.exec(run[run.length - 1].w)?.[0] ?? '', n = numeralize(run.map(w => w.w.replace(/[.,;:!?]+$/, '')).join(' '));
    if (!/\d/.test(n) || /[a-z]{3,}/i.test(n.replace(/\b(million|billion|thousand)\b/gi, ''))) { out.push(ws[i]); continue; } // only a clean number replaces the words
    out.push({...run[0], w: n + tail, end: run[run.length - 1].end});
    i = j - 1;
  }
  return out;
}
export function buildPunchPhrases(sceneWords: CaptionWord[][]): Phrase[] {
  const out: Phrase[] = [];
  for (const ws0 of sceneWords) {
    const ws = numeralWords(ws0);
    let a = 0;
    ws.forEach((w, k) => {
      if (!/[.!?,;:]$/.test(w.w) && k < ws.length - 1) return;
      for (const cur of chunkClause(ws.slice(a, k + 1))) out.push({start: cur[0].start, end: cur[cur.length - 1].end, words: cur});
      a = k + 1;
    });
  }
  return out;
}
function chunkClause(c: CaptionWord[]): CaptionWord[][] {
  const low = (k: number) => bare(c[k].w).toLowerCase();
  const glued = (k: number) => NUM.test(bare(c[k].w)) && (UNIT.test(bare(c[k + 1].w)) || NUM.test(bare(c[k + 1].w)));
  const best = [0, ...c.map(() => Infinity)], from = c.map(() => 0).concat(0);
  for (let e = 1; e <= c.length; e++) for (let n = 1; n <= Math.min(4, e); n++) {
    const s = e - n, chars = c.slice(s, e).reduce((x, w) => x + bare(w.w).length, 0);
    let cost = 1 + (n === 1 && c.length > 1 ? 4 : n === 4 ? 0.3 : 0) + Math.max(0, chars - 18) * 0.5; // 1 per chunk: fewer, fuller chunks win ties
    if (e < c.length) cost += (glued(e - 1) ? 20 : 0) + (DANGLING.has(low(e - 1)) ? 8 : 0) + (low(e) === 'of' ? 2 : 0) - (STARTERS.has(low(e)) || (/^\w{3,}ly$/.test(low(e)) && !/^(daily|weekly|monthly|yearly|early|only|likely|family|friendly|costly)$/.test(low(e))) ? 1 : 0); // adverbs open a unit too ("QUIETLY EATS")
    if (best[s] + cost < best[e]) { best[e] = best[s] + cost; from[e] = s; }
  }
  const res: CaptionWord[][] = [];
  for (let e = c.length; e > 0; e = from[e]) res.unshift(c.slice(from[e], e));
  return res;
}

const isKey = (w: string) => /\d|%|\$/.test(w) || !isFunctionWord(w);
/** A phrase deserves a punch word when it carries a number or a long content word; only every 4th such phrase gets one so it stays special. */
/** Phrases that get the big punch word: a qualifying word, and at least PUNCH_GAP s after the previous punch (QUALITY-PLAN 9: max 1 per 6-8 s). */
export const PUNCH_GAP = 6.5;
export function punchSchedule(phrases: Phrase[]): Set<number> {
  const out = new Set<number>();
  let last = -Infinity;
  phrases.forEach((p, i) => { if (p.start - last >= PUNCH_GAP && punchWord(p, 0)) { out.add(i); last = p.start; } });
  return out;
}
export const punchWord = (p: Phrase, n: number): CaptionWord | undefined => (n % 4 === 0 ? [...p.words].sort((a, b) => (/\d|%|\$/.test(b.w) ? 99 : b.w.length) - (/\d|%|\$/.test(a.w) ? 99 : a.w.length)).find(w => (/\d|%|\$/.test(w.w) || w.w.replace(/\W/g, '').length >= 6) && isKey(w.w) && !NO_PUNCH.test(w.w) && !isBareVerb(w.w)) : undefined);
// framing words ("The takeaway: ...") say nothing about the sentence: never the big punch word
/** A bare verb or verb form says nothing alone on screen ("CREATES", "KEEPING"): punch words and headlines are nouns, numbers or adjectives. Heuristic, no POS tagger. */
export const isBareVerb = (w: string) => { const x = w.toLowerCase().replace(/[^a-z]/g, ''); return /^(creates?|makes?|causes?|keeps?|gets?|means?|becomes?|leads?|adds?|takes?|gives?|helps?|lets?|needs?|shows?|turns?|stays?|goes|comes?|happens?|seems?|feels?|tells?|forces?|drives?|pushes?|pulls?|matters?|works?|changes?|stops?|starts?|equals?|triggers?|explains?|says?)$/.test(x) || /(ates|izes|ises|ifies|ing|ed)$/.test(x) && x.length > 4; };
/** On-screen number: en-US separators, and millions/billions short ("$10000000" -> "$10M", "1825" -> "1,825"). Non-numbers pass through. */
export function screenNumber(w: string): string {
  const m = /^(\$?)([\d,]+(?:\.\d+)?)(%?)$/.exec(w);
  if (!m) return w;
  const n = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(n) || /^\d{4}$/.test(m[2]) && !m[1] && !m[3] && n >= 1900 && n <= 2100) return w; // years stay "2024"
  const short = n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n.toLocaleString('en-US', {maximumFractionDigits: 2});
  return `${m[1]}${short}${m[3]}`;
}
const NO_PUNCH = /^(takeaways?|yourself|insights?|follow|basically|actually|remember)\W*$|['’]s\W*$/i; // possessives ("PHONE'S") read as a typo on their own

export const PunchCaptions: React.FC<{phrases: Phrase[]; t: number; accent: string; w: number; h: number; punch?: boolean}> = ({phrases, t, accent, w, h, punch = true}) => {
  let idx = -1;
  phrases.forEach((p, i) => { if (t >= p.start - 0.04 && t <= p.end + 0.3) idx = i; });
  if (idx < 0) return null;
  const phrase = phrases[idx], enter = clamp((t - (phrase.start - 0.04)) / 0.12), tall = h > w;
  const size = tall ? 70 : 64, sched = React.useMemo(() => punchSchedule(phrases), [phrases]), pw = punch && sched.has(idx) ? punchWord(phrase, 0) : undefined;
  const stroke = `${size * 0.11}px #000`; // the stroke paints outside the glyph box, so the gap below must cover it plus the active-word scale
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: tall ? h * 0.7 : h * 0.78, display: 'flex', justifyContent: 'center', columnGap: size * 0.62, rowGap: size * 0.1, flexWrap: 'wrap', padding: `0 ${w * 0.08}px`, opacity: Math.min(1, enter * 2), transform: `scale(${0.88 + 0.12 * spring(enter)})`}}>
        {phrase.words.map((x, i) => {
          const active = t >= x.start - 0.02 && t < x.end + 0.1 && isKey(x.w);
          return <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, textTransform: 'uppercase', color: active ? '#ffe033' : '#fff', WebkitTextStroke: stroke, paintOrder: 'stroke fill', textShadow: '0 5px 0 rgba(0,0,0,0.5)', transform: `scale(${active ? 1.04 : 1})`, display: 'inline-block'}}>{x.w.replace(/[.,;:!?]+$/, '')}</span>;
        })}
      </div>
      {pw && (() => {
        // three designed looks, rotating per punch (the same tilted pill every time read as a template): accent pill, white word over a wiping accent bar, accent word on its own
        const e = easeOut(clamp((t - pw.start) / 0.14)), word = pw.w.replace(/[.,;:!?]+$/, ''), look = [...sched].indexOf(idx) % 3;
        const ps = Math.min(tall ? 200 : 170, (w * 0.8) / (Math.max(3, word.replace(/\W/g, '').length) * 0.95 + 0.6)); // fits the frame incl. padding and the tilt (BEFORE was clipped, ep011; SCREENS at 0.8 em/glyph too, ep015)
        const wipe = easeOut(clamp((t - pw.start - 0.08) / 0.25)), base: React.CSSProperties = {fontFamily: DISPLAY, fontSize: ps, textTransform: 'uppercase', display: 'inline-block', lineHeight: 1};
        return (
          <div style={{position: 'absolute', left: 0, right: 0, top: tall ? 330 : h * 0.1, textAlign: 'center', opacity: e, transform: look === 0 ? `rotate(${-4 * e}deg) scale(${0.6 + 0.4 * e})` : look === 1 ? `translateY(${(1 - e) * 40}px)` : `scale(${1.25 - 0.25 * e})`}}>
            {look === 0 && <span style={{...base, color: '#fff', background: accent, padding: `0.06em ${ps * 0.2}px`, borderRadius: ps * 0.12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', WebkitTextStroke: `${ps * 0.03}px rgba(0,0,0,0.35)`}}>{word}</span>}
            {look === 1 && <span style={{...base, position: 'relative', color: '#fff', textShadow: '0 6px 24px rgba(0,0,0,0.6)'}}><span style={{position: 'absolute', left: '-4%', bottom: '-2%', height: '32%', width: `${108 * wipe}%`, background: accent, borderRadius: ps * 0.06, zIndex: -1}} />{word}</span>}
            {look === 2 && <span style={{...base, color: accent, WebkitTextStroke: `${ps * 0.035}px #fff`, paintOrder: 'stroke fill', textShadow: '0 10px 0 rgba(0,0,0,0.35), 0 20px 50px rgba(0,0,0,0.5)'}}>{word}</span>}
          </div>);
      })()}
    </>
  );
};
