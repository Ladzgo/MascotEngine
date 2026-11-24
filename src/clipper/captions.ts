import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
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
