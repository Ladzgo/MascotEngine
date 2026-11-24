import fs from 'node:fs';
import {ACCENT_HEX} from '../accents.js';
import type {Branding} from '../Branding.js';
import {channelDir, loadChannel} from './channel.js';

const MAX_IMG = 300 * 1024;

/** Branding for a channel, or null when the channel has none (then Shorts/clips are rendered exactly as before). */
export function loadBranding(channelId = 'default'): Branding | null {
  let ch;
  try { ch = loadChannel(channelId); } catch { return null; }
  if (!ch.branding) return null;
  let image: string | undefined;
  const f = `${channelDir(ch.id)}watermark.png`;
  if (fs.existsSync(f) && fs.statSync(f).size <= MAX_IMG) image = `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  return {name: ch.name, handle: ch.branding.handle, cta: ch.branding.cta, outroSec: ch.branding.outroSec, watermark: ch.branding.watermark, accent: ACCENT_HEX[ch.accent ?? ''] ?? '#c8662a', image};
}
