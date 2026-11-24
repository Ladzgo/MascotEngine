import React from 'react';

/** Boil step: outlines re-jitter every STEP frames. Deterministic: derived from the frame number only. */
export const BOIL_STEP = 3;
export const boilSeed = (frame: number) => Math.floor(frame / BOIL_STEP) % 97;

/** Global SVG filter defs. Apply with style={{filter: 'url(#boil)'}} on drawn content. */
export const BoilDefs: React.FC<{frame: number}> = ({frame}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      <filter id="boil" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={2} seed={boilSeed(frame)} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} />
        <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0.07 0" />
      </filter>
    </defs>
  </svg>
);

export const BOIL_STYLE: React.CSSProperties = {filter: 'url(#boil)'};
