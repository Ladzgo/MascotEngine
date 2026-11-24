import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Mascot, type CharacterAssets} from './character/Mascot';
import {ACCENT_HEX} from './accents';
import {DISPLAY, INK, PAPER, loadFonts} from './theme';

export const THUMB_W = 1280, THUMB_H = 720;
export type ThumbProps = {text: string; accent: string; pose: string; assets: CharacterAssets; variant?: 'a' | 'b' | 'c'};

// Archivo Black is ~0.74 em per capital: shrink until the longest word fits `budget` px (never over the mascot)
const fit = (words: string[], max: number, budget: number) => Math.min(max, Math.floor(budget / (Math.max(...words.map(w => w.length), 3) * 0.74)));

const words4 = (text: string) => text.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 4);
/** Headline font size in px for a variant; below ~100 px the text is hard to read at 150 px wide. */
export const thumbSize = (variant: 'a' | 'b' | 'c', text: string) => fit(words4(text), variant === 'c' ? 190 : 220, variant === 'c' ? 700 : 730);
export const MIN_THUMB_SIZE = 100;

/**
 * YouTube thumbnail (1280x720), both variants built for 150 px legibility: 2-3 word hook, one accent word,
 * heavy ink outline, no text over the mascot.
 * a: paper left with stacked ink text, accent wedge + mascot right.  b: full accent field, white text, big mascot bleeding off the bottom.
 */
export const Thumbnail: React.FC<ThumbProps> = ({text, accent, pose, assets, variant = 'a'}) => {
  loadFonts();
  const hex = ACCENT_HEX[accent] ?? ACCENT_HEX.violet;
  const words = words4(text);
  const last = words.length - 1;
  if (variant === 'c') { // question style: ink field, giant accent question mark behind the mascot, white question text
    const size = fit(words, 190, 700);
    return (
      <AbsoluteFill style={{background: INK}}>
        <div style={{position: 'absolute', right: 40, top: -120, fontFamily: DISPLAY, fontSize: 900, lineHeight: 1, color: hex, opacity: 0.95}}>?</div>
        <div style={{position: 'absolute', right: 60, bottom: -40}}>
          <Mascot pose={pose} talking={false} accent={accent} frame={0} height={600} assets={assets} enter={1} />
        </div>
        <div style={{position: 'absolute', left: 52, top: 0, bottom: 0, width: 740, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          {words.map((w, i) => (
            <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 0.98, letterSpacing: -2, color: i === last ? '#ffe14d' : '#fff', WebkitTextStroke: `${Math.round(size * 0.05)}px #000`, paintOrder: 'stroke fill'}}>{w}</span>
          ))}
        </div>
      </AbsoluteFill>
    );
  }
  if (variant === 'b') {
    const size = fit(words, 220, 730);
    return (
      <AbsoluteFill style={{background: hex}}>
        <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle at 78% 55%, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%)`}} />
        <div style={{position: 'absolute', right: -120, bottom: -70}}>
          <Mascot pose={pose} talking={false} accent={accent} frame={0} height={720} assets={assets} enter={1} />
        </div>
        <div style={{position: 'absolute', left: 52, top: 0, bottom: 0, width: 700, display: 'flex', flexDirection: 'column', justifyContent: 'center', transform: 'rotate(-3deg)'}}>
          {words.map((w, i) => (
            <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 0.98, letterSpacing: -2, color: i === last ? '#ffe14d' : '#fff', WebkitTextStroke: `${Math.round(size * 0.1)}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 8px 0 ${INK}`}}>{w}</span>
          ))}
        </div>
      </AbsoluteFill>
    );
  }
  const size = fit(words, 220, 730);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <div style={{position: 'absolute', right: 0, top: 0, width: 540, height: THUMB_H, background: hex, clipPath: 'polygon(24% 0, 100% 0, 100% 100%, 0 100%)'}} />
      <div style={{position: 'absolute', right: 20, bottom: -20, filter: 'drop-shadow(0 10px 0 rgba(0,0,0,0.25))'}}>
        <Mascot pose={pose} talking={false} accent={accent} frame={0} height={640} assets={assets} enter={1} />
      </div>
      <div style={{position: 'absolute', left: 52, top: 0, bottom: 0, width: 740, display: 'flex', flexDirection: 'column', justifyContent: 'center', transform: 'rotate(-2deg)'}}>
        {words.map((w, i) => (
          <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 0.98, letterSpacing: -2, color: i === last ? hex : INK, WebkitTextStroke: `${Math.round(size * (i === last ? 0.07 : 0.03))}px ${INK}`, paintOrder: 'stroke fill', textShadow: i === last ? `0 7px 0 ${INK}` : undefined}}>{w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
