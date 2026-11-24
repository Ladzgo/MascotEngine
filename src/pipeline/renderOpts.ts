import type {ChromiumOptions} from '@remotion/renderer';

/**
 * Chromium GL backend for Remotion. Measured on an 8-core Mac (300 frames, 1280x720 preview): default 13.7 s,
 * `angle` 5 s (2.7x). Default: angle on macOS; elsewhere Remotion's default (headless Linux without a GPU is not
 * known to benefit; try RENDER_GL=angle there and compare with scripts/qa/benchRender.ts). RENDER_GL=default disables.
 */
export function chromiumTuning(env = process.env, platform = process.platform): ChromiumOptions {
  const gl = env.RENDER_GL ?? (platform === 'darwin' ? 'angle' : '');
  return gl && gl !== 'default' ? {gl: gl as ChromiumOptions['gl']} : {};
}
