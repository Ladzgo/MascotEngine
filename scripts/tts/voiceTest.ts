/** A/B the voices: `npm run voice-test -- --text "..." --lang en|hu [--no-open]` renders the paragraph with every available engine to out/voice-test/<engine>.wav and prints LUFS. */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseArgs} from 'node:util';
import {neuralPost, neuralStatus, renderSpeech, type NeuralName} from '../../src/pipeline/neural.js';
import {langInfo} from '../../src/channel/lang.js';
import {spoken} from '../../src/pipeline/speech.js';

const {values} = parseArgs({options: {text: {type: 'string'}, lang: {type: 'string'}, 'no-open': {type: 'boolean'}, out: {type: 'string'}}});
const lang = values.lang ?? 'en';
const text = values.text ?? (lang === 'hu' ? 'Ha csak a minimumot fizeted a hitelkártyádon, tízezer forint adósság is évekig kísért. A kamat havonta hat százalék körül nő, és a tartozás alig csökken.' : 'Pay only the minimum on a $2,000 credit card at 21% APR, and it takes eighteen years to clear. Most of every payment is interest, so the debt barely moves.');
const out = (values.out ?? 'out/voice-test').replace(/\/?$/, '/');
fs.mkdirSync(out, {recursive: true});

const lufs = (f: string) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], {encoding: 'utf8'}); const m = /"input_i"\s*:\s*"(-?[\d.]+)"/.exec(r.stderr); return m ? +m[1] : NaN; };
const dur = (f: string) => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {encoding: 'utf8'}).stdout.trim();
const made: string[] = [];
const rows: string[] = [];
const done = (name: string, f: string) => { made.push(f); rows.push(`${name.padEnd(8)} ${dur(f).toFixed(1).padStart(5)} s  ${lufs(f).toFixed(1).padStart(6)} LUFS  ${f}`); };

for (const e of ['kokoro', 'piper', 'edge'] as NeuralName[]) {
  const st = neuralStatus(e, lang);
  if (!st.ok) { rows.push(`${e.padEnd(8)} skipped: ${st.detail}${st.fix ? ` (fix: ${st.fix})` : ''}`); continue; }
  const raw = `${out}${e}.raw.wav`, f = `${out}${e}.wav`;
  try {
    renderSpeech(e, text, lang, raw, {seed: 7});
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', `${neuralPost()},loudnorm=I=-14:TP=-1.5:LRA=7`, '-ar', '44100', f]);
    fs.rmSync(raw, {force: true}); done(e, f);
  } catch (x) { rows.push(`${e.padEnd(8)} failed: ${(x as Error).message.slice(0, 200)}`); }
}
if (spawnSync('sh', ['-c', 'command -v say'], {stdio: 'ignore'}).status === 0) {
  const aiff = `${out}say.aiff`, f = `${out}say.wav`;
  spawnSync('say', ['-v', langInfo(lang).say || 'Samantha', '-o', aiff, '--', spoken(text, lang)]);
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', aiff, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7', '-ar', '44100', f]);
  fs.rmSync(aiff, {force: true}); done('say', f);
}
console.log(`Text: ${text}\n${rows.join('\n')}`);
if (!values['no-open'] && made.length && process.platform === 'darwin') spawnSync('open', made);
