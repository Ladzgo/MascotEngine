import React from 'react';
import {DISPLAY, clamp, easeOut, spring} from '../theme';
import {isFunctionWord, type CaptionWord, type Phrase} from './captions';

/** 'punch' caption preset: 2-3 words at a time, centred in the lower third, heavy white type with a black outline, current keyword yellow. */
export function buildPunchPhrases(sceneWords: CaptionWord[][]): Phrase[] {
  const out: Phrase[] = [];
  for (const ws of sceneWords) {
    let cur: CaptionWord[] = [];
    const flush = () => { if (cur.length) out.push({start: cur[0].start, end: cur[cur.length - 1].end, words: cur}); cur = []; };
    ws.forEach((w, i) => {
      cur.push(w);
      const chars = cur.reduce((a, x) => a + x.w.length, 0), end = /[.!?,;:]$/.test(w.w);
      if (cur.length >= 3 || end || (cur.length === 2 && chars > 13) || (cur.length === 2 && ws[i + 1] && /[.!?]$/.test(ws[i + 1].w) && false)) flush();
    });
    flush();
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
  const size = tall ? 112 : 92, pw = punch ? punchWord(phrase, idx) : undefined;
  const stroke = `${size * 0.16}px #000`;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: tall ? h * 0.69 : h * 0.76, display: 'flex', justifyContent: 'center', gap: size * 0.42, flexWrap: 'wrap', padding: `0 ${w * 0.06}px`, opacity: Math.min(1, enter * 2), transform: `scale(${0.88 + 0.12 * spring(enter)})`}}>
        {phrase.words.map((x, i) => {
          const active = t >= x.start - 0.02 && t < x.end + 0.1 && isKey(x.w);
          return <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, textTransform: 'uppercase', color: active ? '#ffe033' : '#fff', WebkitTextStroke: stroke, paintOrder: 'stroke fill', textShadow: '0 8px 0 rgba(0,0,0,0.55)', transform: `scale(${active ? 1.07 : 1})`, display: 'inline-block'}}>{x.w.replace(/[.,;:!?]+$/, '')}</span>;
        })}
      </div>
      {pw && (() => { const e = easeOut(clamp((t - pw.start) / 0.14)), ps = Math.min(tall ? 210 : 170, (w * 0.86) / (Math.max(3, pw.w.replace(/\W/g, '').length) * 0.78)); return (
        <div style={{position: 'absolute', left: 0, right: 0, top: tall ? 330 : h * 0.1, textAlign: 'center', opacity: e, transform: `rotate(${-4 * e}deg) scale(${0.6 + 0.5 * e})`}}>
          <span style={{fontFamily: DISPLAY, fontSize: ps, textTransform: 'uppercase', color: '#fff', background: accent, padding: `0 ${ps * 0.2}px`, borderRadius: ps * 0.12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', WebkitTextStroke: `${ps * 0.03}px rgba(0,0,0,0.35)`, display: 'inline-block'}}>{pw.w.replace(/[.,;:!?]+$/, '')}</span>
        </div>); })()}
    </>
  );
};
