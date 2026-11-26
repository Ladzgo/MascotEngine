import {bestNeural} from '../pipeline/neural.js';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pickModel} from '../llm/llm.js';

export type Item = {id: string; label: string; ok: boolean; required: boolean; detail: string; fix: string};
export type Probe = {
  env: NodeJS.ProcessEnv; platform: string; root: string; nodeVersion: string;
  onPath: (bin: string) => boolean;
  ffmpegHas: (encoder: string) => boolean;
  ollamaModels: () => Promise<string[]>;
};

export function realProbe(root: string): Probe {
  const onPath = (b: string) => (process.env.PATH ?? '').split(path.delimiter).some(d => { try { fs.accessSync(path.join(d, b), fs.constants.X_OK); return true; } catch { return false; } });
  return {
    env: process.env, platform: process.platform, root, nodeVersion: process.versions.node, onPath,
    ffmpegHas: enc => (spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {encoding: 'utf8'}).stdout ?? '').includes(` ${enc} `),
    ollamaModels: async () => {
      try { const r = await fetch(`${process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'}/api/tags`, {signal: AbortSignal.timeout(1500)}); return ((await r.json()) as {models?: {name: string}[]}).models?.map(x => x.name) ?? []; } catch { return []; }
    },
  };
}

/** Remotion's headless Chromium (node_modules/.remotion), an explicit REMOTION_BROWSER_EXECUTABLE, or a system chromium/chrome. */
function findChromium(p: Probe): string {
  const ex = p.env.REMOTION_BROWSER_EXECUTABLE ?? p.env.PUPPETEER_EXECUTABLE_PATH;
  if (ex && fs.existsSync(ex)) return ex;
  const dir = path.join(p.root, 'node_modules/.remotion');
  const walk = (d: string, depth: number): string => {
    if (depth > 4 || !fs.existsSync(d)) return '';
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const f = path.join(d, e.name);
      if (e.isFile() && /^(chrome-headless-shell|chrome|headless_shell)$/.test(e.name)) return f;
      if (e.isDirectory()) { const r = walk(f, depth + 1); if (r) return r; }
    }
    return '';
  };
  return walk(dir, 0) || ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'].find(p.onPath) || '';
}

/** One shared environment check: used by `npm run doctor`; studio/server.ts GET /api/readiness can call it instead of its own copy. */
export async function checkReadiness(p: Probe = realProbe(path.resolve(new URL('../../', import.meta.url).pathname))): Promise<{ok: boolean; items: Item[]}> {
  const item = (id: string, label: string, required: boolean, ok: boolean, detail: string, fix: string): Item => ({id, label, required, ok, detail: ok ? detail : '', fix: ok ? '' : fix});
  const models = await p.ollamaModels();
  const picked = pickModel(models, p.env.OLLAMA_MODEL);
  const whisperModel = p.env.WHISPER_MODEL && fs.existsSync(p.env.WHISPER_MODEL) ? p.env.WHISPER_MODEL : fs.existsSync(path.join(p.root, 'data/models/ggml-base.en.bin')) ? 'data/models/ggml-base.en.bin' : '';
  const musicDir = path.join(p.root, 'assets/music');
  const music = fs.existsSync(musicDir) ? fs.readdirSync(musicDir).filter(f => /\.(mp3|wav|m4a|ogg)$/i.test(f)) : [];
  const piper = (p.onPath('piper') || (!!p.env.PIPER_BIN && fs.existsSync(p.env.PIPER_BIN))) && !!p.env.PIPER_MODEL && fs.existsSync(p.env.PIPER_MODEL);
  const voice = p.platform === 'darwin' && p.onPath('say') ? 'say' : piper ? 'piper' : p.onPath('espeak-ng') ? 'espeak-ng' : '';
  const nb = (['en', 'hu'] as const).map(l => [l, bestNeural(l)] as const).filter(([, e]) => e).map(([l, e]) => `${l}: ${e}`);
  const neuralBest = nb.length === 2 ? nb.join(', ') : ''; // both languages need a natural voice for 'ok'
  const chromium = findChromium(p);
  const ff = p.onPath('ffmpeg') && p.onPath('ffprobe');
  const items = [
    item('node', 'Node.js 20+', true, +p.nodeVersion.split('.')[0] >= 20, `v${p.nodeVersion}`, 'Install Node 20 or newer.'),
    item('node-modules', 'npm packages', true, fs.existsSync(path.join(p.root, 'node_modules/remotion')), 'node_modules present', 'Run `npm ci` (offline: unpack the bundle, see docs/OFFLINE.md).'),
    item('ffmpeg', 'ffmpeg + ffprobe', true, ff, 'ffmpeg + ffprobe found', 'Install ffmpeg: `brew install ffmpeg` (macOS) or `apt install ffmpeg`.'),
    item('x264', 'ffmpeg libx264 + aac', true, ff && p.ffmpegHas('libx264') && p.ffmpegHas('aac'), 'libx264 and aac available', 'Use an ffmpeg build with libx264 (the apt package has it).'),
    item('prores', 'ffmpeg ProRes (Clipper captions)', false, ff && p.ffmpegHas('prores_ks'), 'prores_ks available', 'Use a full ffmpeg build (apt ffmpeg has prores_ks); only the Clipper captions need it.'),
    item('chromium', 'Chromium for Remotion', true, !!chromium, chromium, 'Run `npx remotion browser ensure` online once and copy node_modules/.remotion, or install chromium and set REMOTION_BROWSER_EXECUTABLE.'),
    item('whisper-bin', 'whisper.cpp (whisper-cli)', false, p.onPath('whisper-cli'), 'whisper-cli found', 'Run `brew install whisper-cpp`, or build whisper.cpp and put whisper-cli on PATH (captions fall back to estimated timing; the Clipper needs it).'),
    item('whisper-model', 'Whisper model', false, !!whisperModel, whisperModel, 'Copy ggml-base.en.bin to data/models/ or set WHISPER_MODEL.'),
    item('ollama', 'Ollama running', false, models.length > 0, 'running', 'Install Ollama and run `ollama serve` (the Studio can also start it).'),
    item('ollama-model', 'Ollama model', false, !!picked, picked ?? '', 'Run `ollama pull qwen2.5:7b` (offline: copy ~/.ollama/models from another machine, see docs/OFFLINE.md).'),
    item('music', 'Music bed', false, music.length > 0, music.join(', '), 'Put a licensed track in assets/music/ (an ambient pad ships with the repo).'),
    item('voice-neural', 'Natural voice (Kokoro English, Piper Hungarian)', false, !!neuralBest, neuralBest, 'Run `npm run setup:voice` (about 700 MB, free, keyless; creates .venv-tts and data/models/tts). Without it the robotic macOS `say` voice is used.'),
    item('voice', 'Voice engine', false, !!voice, voice, 'Linux: apt install espeak-ng, or set PIPER_BIN and PIPER_MODEL. macOS has say built in. (--engine silent works without.)'),
  ];
  return {ok: items.every(i => i.ok || !i.required), items};
}
