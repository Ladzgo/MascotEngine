import React from 'react';
import {DISPLAY, clamp, easeOut, spring} from '../theme';
import {isFunctionWord, type CaptionWord, type Phrase} from './captions';

/** 'punch' caption preset: 2-3 words at a time, centred in the lower third, heavy white type with a black outline, current keyword yellow. */
const NUM = /^(\d[\d,.]*%?|\$\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|twenty-\w+)$/i;
const UNIT = /^(years?|months?|weeks?|days?|hours?|percent|dollars?|euros?|times|thousand|million|billion|hundred|cents?|%)$/i;
const bare = (w: string) => w.replace(/[^\w$%.,-]/g, '').replace(/[.,;:!?]+$/, '');
/** Words that must not end a caption chunk (the phrase would dangle: "EIGHTEEN YEARS TO"). */
const DANGLING = new Set('a an the of to in on at for and or but with as by from than then that this your their its is are was were be it you we they if so not no into over under about'.split(' '));
/**
 * 'punch' preset chunks: at most 3 words (4 when a number+unit run needs it), cut at punctuation, never between a number and its unit,
 * never ending on a dangling function word (that word moves to the next chunk).
 */
export function buildPunchPhrases(sceneWords: CaptionWord[][]): Phrase[] {
  const out: Phrase[] = [];
  for (const ws of sceneWords) {
    let i = 0;
    while (i < ws.length) {
      let n = 0;
      while (i + n < ws.length) {
        n++;
        const w = ws[i + n - 1], next = ws[i + n];
        if (/[.!?,;:]$/.test(w.w)) break;
        if (!next) break;
        const glued = NUM.test(bare(w.w)) && (UNIT.test(bare(next.w)) || NUM.test(bare(next.w))); // number + unit (or number + number) stay together
        if (n >= (glued ? 4 : 3)) break;
        if (n === 2 && w.w.length + ws[i].w.length > 13 && !glued) break;
      }
      while (n > 1 && DANGLING.has(bare(ws[i + n - 1].w).toLowerCase()) && !/[.!?,;:]$/.test(ws[i + n - 1].w)) n--; // do not end on "to", "the"...
      const cur = ws.slice(i, i + n);
      out.push({start: cur[0].start, end: cur[cur.length - 1].end, words: cur});
      i += n;
    }
  }
  return out;
}

const isKey = (w: string) => /\d|%|\$/.test(w) || !isFunctionWord(w);
/** A phrase deserves a punch word when it carries a number or a long content word; only every 4th such phrase gets one so it stays special. */
export const punchWord = (p: Phrase, n: number): CaptionWord | undefined => (n % 4 === 0 ? [...p.words].sort((a, b) => (/\d|%|\$/.test(b.w) ? 99 : b.w.length) - (/\d|%|\$/.test(a.w) ? 99 : a.w.length)).find(w => (/\d|%|\$/.test(w.w) || w.w.replace(/\W/g, '').length >= 6) && isKey(w.w)) : undefined);

export const PunchCaptions: React.FC<{phrases: Phrase[]; t: number; accent: string; w: number; h: number; punch?: boolean}> = ({phrases, t, accent, w, h, punch = true}) => {
  let idx = -1;
  phrases.forEach((p, i) => { if (t >= p.start - 0.04 && t <= p.end + 0.3) idx = i; });
  if (idx < 0) return null;
  const phrase = phrases[idx], enter = clamp((t - (phrase.start - 0.04)) / 0.12), tall = h > w;
  const size = tall ? 76 : 68, pw = punch ? punchWord(phrase, idx) : undefined;
  const stroke = `${size * 0.15}px #000`;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: tall ? h * 0.7 : h * 0.78, display: 'flex', justifyContent: 'center', gap: size * 0.42, flexWrap: 'wrap', padding: `0 ${w * 0.08}px`, opacity: Math.min(1, enter * 2), transform: `scale(${0.88 + 0.12 * spring(enter)})`}}>
        {phrase.words.map((x, i) => {
          const active = t >= x.start - 0.02 && t < x.end + 0.1 && isKey(x.w);
          return <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, textTransform: 'uppercase', color: active ? '#ffe033' : '#fff', WebkitTextStroke: stroke, paintOrder: 'stroke fill', textShadow: '0 5px 0 rgba(0,0,0,0.5)', transform: `scale(${active ? 1.07 : 1})`, display: 'inline-block'}}>{x.w.replace(/[.,;:!?]+$/, '')}</span>;
        })}
      </div>
      {pw && (() => { const e = easeOut(clamp((t - pw.start) / 0.14)), ps = Math.min(tall ? 210 : 170, (w * 0.86) / (Math.max(3, pw.w.replace(/\W/g, '').length) * 0.78)); return (
        <div style={{position: 'absolute', left: 0, right: 0, top: tall ? 330 : h * 0.1, textAlign: 'center', opacity: e, transform: `rotate(${-4 * e}deg) scale(${0.6 + 0.5 * e})`}}>
          <span style={{fontFamily: DISPLAY, fontSize: ps, textTransform: 'uppercase', color: '#fff', background: accent, padding: `0 ${ps * 0.2}px`, borderRadius: ps * 0.12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', WebkitTextStroke: `${ps * 0.03}px rgba(0,0,0,0.35)`, display: 'inline-block'}}>{pw.w.replace(/[.,;:!?]+$/, '')}</span>
        </div>); })()}
    </>
  );
};
