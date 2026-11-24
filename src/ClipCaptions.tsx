import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {DISPLAY, loadFonts, spring} from './theme';
import {isFunctionWord} from './fx/captions';

export const CLIP_CAP_W = 1080;
export const CLIP_CAP_H = 300;
export type CapWord = {w: string; start: number; end: number}; // seconds from clip start
export type ClipCaptionProps = {words: CapWord[]; durationSec: number};
export type Chunk = {from: number; to: number; words: CapWord[]; first: number};

/** 3-word chunks (2 when long), shown from 0.05 s before the first word until the next chunk starts or 0.2 s after the last word. */
export function captionChunks(words: CapWord[]): Chunk[] {
  const out: Chunk[] = [];
  for (let i = 0; i < words.length;) {
    let n = Math.min(3, words.length - i);
    while (n > 1 && words.slice(i, i + n).reduce((a, w) => a + w.w.length + 1, 0) > 24) n--;
    out.push({from: 0, to: 0, words: words.slice(i, i + n), first: i});
    i += n;
  }
  out.forEach((c, k) => {
    const last = c.words[c.words.length - 1], next = out[k + 1];
    c.from = Math.max(0, c.words[0].start - 0.05);
    c.to = next && next.words[0].start - last.end < 0.6 ? next.words[0].start - 0.05 : last.end + 0.2;
  });
  return out;
}

export const ClipCaptions: React.FC<ClipCaptionProps> = ({words}) => {
  loadFonts();
  const t = useCurrentFrame() / useVideoConfig().fps;
  const chunk = captionChunks(words).find(c => t >= c.from && t < c.to);
  if (!chunk) return <AbsoluteFill />;
  const chars = chunk.words.reduce((a, w) => a + w.w.length + 1, 0);
  const size = Math.min(92, Math.floor(920 / (chars * 0.84))); // fits the 960 px safe width
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{fontFamily: DISPLAY, fontSize: size, textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: 1, display: 'flex', gap: size * 0.4}}>
        {chunk.words.map((w, k) => {
          const next = chunk.words[k + 1];
          const active = t >= w.start && (next ? t < next.start : t < w.end + 0.15) && !isFunctionWord(w.w);
          const pop = active ? 1 + 0.08 * spring((t - w.start) / 0.18) : 1;
          return (
            <span key={k} style={{
              color: active ? '#FFD400' : '#ffffff', display: 'inline-block', transform: `scale(${pop})`,
              WebkitTextStroke: `${Math.round(size * 0.16)}px #000`, paintOrder: 'stroke fill',
              textShadow: '0 7px 0 rgba(0,0,0,0.55), 0 10px 22px rgba(0,0,0,0.5)',
            }}>{w.w}</span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
