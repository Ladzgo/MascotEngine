import React from 'react';
import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {BoilDefs, BOIL_STYLE} from '../fx/boil';
import {PAPER, loadFonts} from '../theme';
import {VISUAL_KINDS} from './kinds';
import {Illustration} from './index';
import {VisualStage} from './Stage';

/** Dev-only contact sheet of every illustration (npx tsx src/visuals/stills.ts). */
const Gallery: React.FC<{t: number; accent: string; mode: string}> = ({t, accent, mode}) => {
  loadFonts();
  const page = mode === 'a' ? VISUAL_KINDS.slice(0, 15) : VISUAL_KINDS.slice(15);
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <BoilDefs frame={0} />
      {mode === 'stage' ? (
        <div style={BOIL_STYLE}><VisualStage box={{x: 880, y: 130, w: 980, h: 720}} hero="credit_card" support={['percent', 'calendar']} label="Interest compounds daily" t={t} accent={accent} /></div>
      ) : (
        <div style={{display: 'flex', flexWrap: 'wrap', ...BOIL_STYLE}}>
          {page.map(k => <div key={k} style={{width: 384, height: 360, position: 'relative'}}><div style={{position: 'absolute', left: 52, top: 10}}><Illustration kind={k} size={280} t={t} accent={accent} /></div><div style={{position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', font: '600 24px sans-serif'}}>{k}</div></div>)}
        </div>
      )}
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="Gallery" component={Gallery} width={1920} height={1080} fps={30} durationInFrames={300} defaultProps={{t: 3, accent: '#e4572e', mode: 'a'}} />);
