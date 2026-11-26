import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {langInfo} from '../channel/lang.js';
import {bestNeural, neuralPost, neuralStatus, renderSpeech, type NeuralName} from './neural.js';
import {spoken} from './speech.js';

export const SAMPLE: Record<string, string> = {
  en: 'Pay only the minimum on a two thousand dollar credit card and it takes eighteen years to clear. Most of every payment is interest, so the debt barely moves.',
  hu: 'Ha csak a minimumot fizeted a hitelkártyádon, a tízezer forintos adósság is évekig kísért. A kamat havonta nő, és a tartozás alig csökken.',
};
export type VoiceRow = {engine: string; label: string; ok: boolean; detail: string; fix: string; online: boolean};

/** Every voice engine with its state for a language (Studio picker and doctor share this). */
export function voiceEngines(lang = 'en'): VoiceRow[] {
  const n = (e: NeuralName, label: string): VoiceRow => { const s = neuralStatus(e, lang); return {engine: e, label, ok: s.ok, detail: s.detail, fix: s.fix, online: !!s.online}; };
  const say = process.platform === 'darwin' && spawnSync('sh', ['-c', 'command -v say'], {stdio: 'ignore'}).status === 0;
  return [
    {engine: 'auto', label: 'Best available (offline first)', ok: true, detail: `uses ${bestNeural(lang) ?? (say ? 'say' : 'silent')} for ${lang}`, fix: '', online: false},
    n('kokoro', 'Kokoro (local, most natural English)'), n('piper', 'Piper (local, Hungarian and English)'), n('edge', 'Microsoft neural voices (online, sends the script text to Microsoft)'),
    {engine: 'say', label: 'macOS built-in voice (robotic, last fallback)', ok: say, detail: say ? 'built in' : 'macOS only', fix: '', online: false},
  ];
}

/** About ten seconds of the chosen voice -> mp3 in `dir`; returns the file path. */
export function previewVoice(engine: string, lang: string, dir: string): string {
  fs.mkdirSync(dir, {recursive: true});
  const text = SAMPLE[lang] ?? SAMPLE.en, e = engine === 'auto' ? (bestNeural(lang) ?? 'say') : engine, out = path.join(dir, `preview-${e}-${lang}.mp3`), wav = out.replace(/\.mp3$/, '.wav');
  if (e === 'kokoro' || e === 'piper' || e === 'edge') {
    const s = neuralStatus(e, lang);
    if (!s.ok) throw new Error(`${s.detail}.${s.fix ? ` Fix: ${s.fix}` : ''}`);
    renderSpeech(e, text, lang, wav, {seed: 7});
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af', `${neuralPost()},loudnorm=I=-14:TP=-1.5`, '-ar', '44100', '-q:a', '3', out]);
  } else if (e === 'say') {
    const r = spawnSync('say', ['-v', langInfo(lang).say || 'Samantha', '-o', wav.replace('.wav', '.aiff'), '--', spoken(text, lang)]);
    if (r.status !== 0) throw new Error('The macOS say command failed.');
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', wav.replace('.wav', '.aiff'), '-af', 'loudnorm=I=-14:TP=-1.5', '-ar', '44100', '-q:a', '3', out]);
    fs.rmSync(wav.replace('.wav', '.aiff'), {force: true});
  } else throw new Error('Preview works for the local, online and macOS voices only.');
  fs.rmSync(wav, {force: true});
  if (!fs.existsSync(out)) throw new Error('No audio was produced.');
  return out;
}
