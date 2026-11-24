import React from 'react';
import {Composition} from 'remotion';
import {ENDCARD_FRAMES, EpisodeVideo, type EpisodeProps} from './Episode';
import {frameLayout} from './Episode';
import {H, W} from './theme';
import {THUMB_H, THUMB_W, Thumbnail, type ThumbProps} from './Thumbnail';
import {SHORT_H, SHORT_W, ShortVideo, outroFrames, shortFrames, type ShortProps} from './ShortEpisode';
import {BrandLayer, type Branding} from './Branding';

import {CLIP_CAP_H, CLIP_CAP_W, ClipCaptions, type ClipCaptionProps} from './ClipCaptions';

const FPS = 30;

export const Root: React.FC = () => (
  <>
  <Composition
    id="Episode"
    component={EpisodeVideo}
    width={W}
    height={H}
    fps={FPS}
    durationInFrames={FPS * 10}
    defaultProps={undefined as unknown as EpisodeProps}
    calculateMetadata={({props}) => {
      const p = props as EpisodeProps;
      const L = frameLayout(p.decisions, FPS);
      const body = L.ends[L.ends.length - 1];
      return {durationInFrames: body + (p.episode.disclaimer ? ENDCARD_FRAMES : 0)};
    }}
  />
  <Composition
    id="Short"
    component={ShortVideo}
    width={SHORT_W}
    height={SHORT_H}
    fps={FPS}
    durationInFrames={FPS * 10}
    defaultProps={undefined as unknown as ShortProps}
    calculateMetadata={({props}) => {
      const p = props as ShortProps;
      return {durationInFrames: Math.max(1, shortFrames(p, FPS).reduce((a, b) => a + b, 0) + outroFrames(p.branding, FPS))};
    }}
  />
  <Composition id="Thumbnail" component={Thumbnail} width={THUMB_W} height={THUMB_H} fps={FPS} durationInFrames={1} defaultProps={undefined as unknown as ThumbProps} />
  <Composition id="BrandLayer" component={BrandLayer} width={SHORT_W} height={SHORT_H} fps={FPS} durationInFrames={1} defaultProps={undefined as unknown as {b: Branding; layer: 'watermark' | 'cta'}} />
  <Composition id="ClipCaptions" component={ClipCaptions} width={CLIP_CAP_W} height={CLIP_CAP_H} fps={FPS} durationInFrames={FPS}
    defaultProps={undefined as unknown as ClipCaptionProps}
    calculateMetadata={({props}) => ({durationInFrames: Math.max(1, Math.ceil((props as ClipCaptionProps).durationSec * FPS))})} />
  </>
);
