import React from 'react';
import {DISPLAY, INK, PAPER, SANS, W} from '../theme';

const FUNCTION_WORDS = new Set('a an the of to in on at for and or but is are was were be it its this that with as by from you your they them their we our so if than then there here do does did will would can could'.split(' '));
/** Function words (to, the, a, of...) are never highlighted; only content words get the accent colour. */
export const isFunctionWord = (w: string) => FUNCTION_WORDS.has(w.toLowerCase().replace(/[^a-z']/g, ''));

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

export type CaptionPrefsT = {style?: string; position: 'bottom' | 'middle' | 'top'; size?: number; highlight: 'accent' | 'underline' | 'none'};
export const DEFAULT_CAPTION_PREFS: CaptionPrefsT = {position: 'bottom', highlight: 'accent'};
/** YouTube Shorts UI covers the bottom ~20% (title, channel, music), the top ~13% (search, header) and a button column on the right: captions stay inside. Real px of 1080x1920. */
export const SHORTS_SAFE = {top: 250, bottom: 380, side: 140};

/** Where captions go. wide: 1920x1080 (title-safe margins). short: 1080x1920 clamped to SHORTS_SAFE (symmetric side margin so they stay centred clear of the button column). */
export function captionLayout(prefs: CaptionPrefsT | undefined, target: 'wide' | 'short') {
  const p = prefs ?? DEFAULT_CAPTION_PREFS;
  if (target === 'wide') {
    const size = p.size ?? 58;
    return {size, maxWidth: W - 360, anchor: p.position, offset: p.position === 'bottom' ? 50 : 70};
  }
  const size = Math.min(p.size ?? 76, 96); // above ~96 px a 6-word phrase no longer fits the safe width in two lines
  return {size, maxWidth: 1080 - 2 * SHORTS_SAFE.side, anchor: p.position, offset: p.position === 'bottom' ? SHORTS_SAFE.bottom : p.position === 'top' ? SHORTS_SAFE.top : 0};
}

export const Captions: React.FC<{phrases: Phrase[]; t: number; accent: string; style: string; size?: number; bottom?: number; maxWidth?: number; anchor?: 'bottom' | 'middle' | 'top'; highlight?: 'accent' | 'underline' | 'none'}> = ({phrases, t, accent, style, size = 58, bottom = 50, maxWidth = W - 360, anchor = 'bottom', highlight = 'accent'}) => {
  const phrase = phrases.filter(p => t >= p.start - 0.05 && t <= p.end + 0.35).pop();
  if (!phrase) return null;
  const inner = phrase.words.map((w, i) => {
    const active = highlight !== 'none' && t >= w.start && t < w.end + 0.02 && !isFunctionWord(w.w);
    const color = active && highlight === 'accent' ? accent : style === 'bar' ? PAPER : INK;
    return <span key={i} style={{color, textDecoration: active && highlight === 'underline' ? `underline 6px ${accent}` : undefined, textUnderlineOffset: 8}}>{w.w}{i < phrase.words.length - 1 ? ' ' : ''}</span>;
  });
  const base: React.CSSProperties = {fontFamily: style === 'outline' ? DISPLAY : SANS, fontWeight: 700, fontSize: size, lineHeight: 1.15, textAlign: 'center', maxWidth, textShadow: style === 'bar' ? '0 2px 0 rgba(0,0,0,0.35)' : undefined};
  const pos: React.CSSProperties = anchor === 'bottom' ? {bottom} : anchor === 'top' ? {top: bottom} : {top: '50%', transform: 'translateY(-50%)'};
  return (
    <div style={{position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', ...pos}}>
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
