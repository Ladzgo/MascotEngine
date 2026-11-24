import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {episodeDir, loadEpisode} from '../schema.js';
import {loadCharacterAssets} from './render.js';

const ROOT = new URL('../../', import.meta.url).pathname;

/** Hook text for the thumbnail: first publish-pack suggestion, else the first words of the title. Max 4 words. */
export function thumbText(dir: string, title: string): string {
  try {
    const t = JSON.parse(fs.readFileSync(`${dir}build/publish.json`, 'utf8')).thumbnailText?.[0];
    if (typeof t === 'string' && t.trim()) return t.trim().split(/\s+/).slice(0, 4).join(' ');
  } catch { /* no pack yet */ }
  return title.replace(/^(why|how|what|the|your)\s+/i, '').split(/\s+/).slice(0, 4).join(' ');
}

const POSE_BY_EMOTION: Record<string, string> = {shocked: 'shocked', worried: 'worried', sweating: 'sweating', smug: 'smug', excited: 'excited', happy: 'happy', angry: 'angry', sad: 'sad', confused: 'confused'};

/** Free local still render: episodes/<id>/build/thumbnail.png (1280x720). */
export async function makeThumbnail(id: string, text?: string): Promise<string> {
  const ep = loadEpisode(id), dir = episodeDir(ep.id);
  let accent = 'violet';
  try { accent = JSON.parse(fs.readFileSync(`${dir}build/decisions.json`, 'utf8')).accent || accent; } catch { /* not directed yet */ }
  const hook = ep.scenes.find(s => s.emotion !== 'neutral');
  const props = {text: text ?? thumbText(dir, ep.title), accent, pose: POSE_BY_EMOTION[hook?.emotion ?? ''] ?? 'shocked', assets: loadCharacterAssets()};
  const serveUrl = await bundle({entryPoint: `${ROOT}src/index.ts`, publicDir: `${ROOT}assets`});
  const comp = await selectComposition({serveUrl, id: 'Thumbnail', inputProps: props});
  fs.mkdirSync(`${dir}build`, {recursive: true});
  const out = `${dir}build/thumbnail.png`;
  await renderStill({composition: comp, serveUrl, output: out, inputProps: props, frame: 0});
  return out;
}
