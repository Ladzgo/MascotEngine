import React from 'react';
import {AbsoluteFill} from 'remotion';
import {INK, PAPER, W, H} from '../theme';

export const Paper: React.FC<{variant: string}> = ({variant}) => (
  <AbsoluteFill style={{background: PAPER}}>
    {variant === 'grid' && (
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <pattern id="g" width={60} height={60} patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" fill="none" stroke="#3a6ea5" strokeOpacity={0.16} strokeWidth={2} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#g)" />
      </svg>
    )}
    {variant === 'dots' && (
      <svg width={W} height={H} style={{position: 'absolute'}}>
        <defs>
          <pattern id="d" width={48} height={48} patternUnits="userSpaceOnUse">
            <circle cx={24} cy={24} r={3} fill={INK} fillOpacity={0.16} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#d)" />
      </svg>
    )}
    {variant === 'vignette' && (
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(90,60,20,0.22) 100%)'}} />
    )}
    <svg width={W} height={H} style={{position: 'absolute'}}>
      <rect width={W} height={H} filter="url(#paper-grain)" />
    </svg>
  </AbsoluteFill>
);
