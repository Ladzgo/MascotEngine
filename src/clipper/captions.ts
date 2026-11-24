import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import type {Branding} from '../Branding.js';
import type {Clip} from './timeline.js';
import {chromiumTuning} from '../pipeline/renderOpts.js';

const ROOT = new URL('../../', import.meta.url).pathname;

/**
 * Word-highlight caption videos (transparent ProRes 4444, 1080x300) rendered with Remotion's own Chromium:
 * no ImageMagick, ffmpeg libass or drawtext needed, so it works the same on Linux offline. One bundle per run.
 * A clip whose captions fail to render gets null (the clip is rendered without captions, with a warning).
 */
export async function renderCaptionVideos(clips: Clip[], dir: string): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (!clips.length) return out;
  const serveUrl = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
  for (const c of clips) {
    const file = path.join(dir, `.${c.id}-captions.mov`);
    try {
      const inputProps = {words: c.words.map(w => ({w: w.w, start: +(w.start - c.start).toFixed(3), end: +(w.end - c.start).toFixed(3)})), durationSec: c.end - c.start};
      const composition = await selectComposition({serveUrl, id: 'ClipCaptions', inputProps});
      await renderMedia({composition, serveUrl, inputProps, codec: 'prores', proResProfile: '4444', pixelFormat: 'yuva444p10le', imageFormat: 'png', outputLocation: file, muted: true, chromiumOptions: chromiumTuning()});
      out.set(c.id, file);
    } catch (e) {
      console.warn(`captions failed for ${c.id} (${(e as Error).message.slice(0, 120)}); rendering without`);
      out.set(c.id, null);
    }
  }
  return out;
}

export const cleanupCaptions = (m: Map<string, string | null>) => m.forEach(f => f && fs.rmSync(f, {force: true}));

/** Transparent full-frame PNG layers (watermark, end card) for the clip's channel; ffmpeg overlays them. */
export async function renderBrandLayers(b: Branding, dir: string): Promise<{watermark: string | null; cta: string | null}> {
  const serveUrl = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
  const one = async (layer: 'watermark' | 'cta') => {
    const output = path.join(dir, `.brand-${layer}.png`), inputProps = {b, layer};
    const composition = await selectComposition({serveUrl, id: 'BrandLayer', inputProps});
    await renderStill({composition, serveUrl, output, inputProps, frame: 0, imageFormat: 'png', chromiumOptions: chromiumTuning()});
    return output;
  };
  return {watermark: b.watermark ? await one('watermark') : null, cta: b.outroSec > 0 ? await one('cta') : null};
}
