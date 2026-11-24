import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Mascot, type CharacterAssets} from './character/Mascot';
import {ACCENT_HEX} from './accents';
import {DISPLAY, INK, PAPER, loadFonts} from './theme';

export const THUMB_W = 1280, THUMB_H = 720;
export type ThumbProps = {text: string; accent: string; pose: string; assets: CharacterAssets};

/** YouTube thumbnail (1280x720): huge 2-4 word hook on the left, mascot on the right, accent block behind. */
export const Thumbnail: React.FC<ThumbProps> = ({text, accent, pose, assets}) => {
  loadFonts();
  const hex = ACCENT_HEX[accent] ?? ACCENT_HEX.violet;
  const words = text.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const size = words.join(' ').length > 14 ? 128 : 168;
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <div style={{position: 'absolute', right: 0, top: 0, width: 560, height: THUMB_H, background: hex, clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)'}} />
      <div style={{position: 'absolute', right: 40, bottom: 0}}>
        <Mascot pose={pose} talking={false} accent={accent} frame={0} height={640} assets={assets} enter={1} />
      </div>
      <div style={{position: 'absolute', left: 56, top: 60, width: 720, display: 'flex', flexDirection: 'column', gap: 0}}>
        {words.map((w, i) => (
          <span key={i} style={{fontFamily: DISPLAY, fontSize: size, lineHeight: 0.98, color: i === words.length - 1 ? hex : INK, WebkitTextStroke: i === words.length - 1 ? `6px ${INK}` : undefined, paintOrder: 'stroke fill', letterSpacing: -2}}>{w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
