import React from 'react';
import {DISPLAY, INK, PAPER, SANS, W} from '../theme';

export type CaptionWord = {w: string; start: number; end: number}; // absolute seconds
export type Phrase = {start: number; end: number; words: CaptionWord[]};

/** Phrase-level captions: <= 6 words, break at punctuation and between scenes. */
export function buildPhrases(sceneWords: CaptionWord[][]): Phrase[] {
  const out: Phrase[] = [];
  for (const ws of sceneWords) {
    let cur: CaptionWord[] = [];
    const flush = () => {
      if (cur.length) out.push({start: cur[0].start, end: cur[cur.length - 1].end, words: cur});
      cur = [];
    };
    ws.forEach((w, i) => {
      cur.push(w);
      const next = ws[i + 1];
      const orphan = next && /[.!?]$/.test(next.w) && !/[.!?]$/.test(w.w); // next word alone would end the sentence
      if ((cur.length >= 6 && !(orphan && cur.length < 8)) || /[.!?]$/.test(w.w) || (cur.length >= 4 && /[,;:]$/.test(w.w))) flush();
    });
    flush();
  }
  return out;
}

export const Captions: React.FC<{phrases: Phrase[]; t: number; accent: string; style: string; size?: number; bottom?: number; maxWidth?: number}> = ({phrases, t, accent, style, size = 58, bottom = 50, maxWidth = W - 360}) => {
  const phrase = phrases.filter(p => t >= p.start - 0.05 && t <= p.end + 0.35).pop();
  if (!phrase) return null;
  const inner = phrase.words.map((w, i) => {
    const active = t >= w.start && t < w.end + 0.02;
    return <span key={i} style={{color: active ? accent : style === 'bar' ? PAPER : INK}}>{w.w}{i < phrase.words.length - 1 ? ' ' : ''}</span>;
  });
  const base: React.CSSProperties = {fontFamily: style === 'outline' ? DISPLAY : SANS, fontWeight: 700, fontSize: size, lineHeight: 1.15, textAlign: 'center', maxWidth};
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center'}}>
      {style === 'bar' && <div style={{...base, background: 'rgba(27,27,31,0.88)', padding: '14px 44px', borderRadius: 14}}>{inner}</div>}
      {style === 'pill' && <div style={{...base, background: PAPER, border: `6px solid ${INK}`, padding: '10px 48px', borderRadius: 60}}>{inner}</div>}
      {style === 'outline' && <div style={{...base, fontSize: size + 6, WebkitTextStroke: `10px ${PAPER}`, paintOrder: 'stroke fill', textShadow: `0 0 2px ${PAPER}`}}>{inner}</div>}
    </div>
  );
};

export function toSrt(phrases: Phrase[]): string {
  const ts = (s: number) => {
    const ms = Math.round(s * 1000);
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return phrases.map((p, i) => `${i + 1}\n${ts(p.start)} --> ${ts(Math.min(p.end + 0.2, phrases[i + 1]?.start ?? Infinity))}\n${p.words.map(w => w.w).join(' ')}\n`).join('\n');
}
