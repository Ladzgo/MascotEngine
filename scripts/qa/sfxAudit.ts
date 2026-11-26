/** Audition by measurement: peak and active RMS of every SFX cue (after its mix gain) against a real narration level. `npx tsx scripts/qa/sfxAudit.ts [voice.wav]` */
import fs from 'node:fs';
import {activeRmsDb, sfxGain, synth} from '../../src/pipeline/audio.js';
import type {SfxKind} from '../../src/director/types.js';

const db = (v: number) => 20 * Math.log10(Math.max(v, 1e-9));
export const KINDS: SfxKind[] = ['pop', 'whoosh', 'tick', 'ding', 'chime'];
export const LIM = {peak: -3, belowVoice: 8}; // dBFS ceiling per cue; active RMS at least this far under the voice (the sidechain duck adds more)

export function audit(voiceRms: number) {
  const rows: {cue: string; peak: number; rms: number; vsVoice: number; ok: boolean}[] = [];
  for (const kind of KINDS) for (let v = 0; v < 6; v++) {
    const x = synth(kind, v), g = sfxGain(kind);
    let pk = 0; for (const s of x) pk = Math.max(pk, Math.abs(s * g));
    const rms = activeRmsDb(x.map(s => s * g)), peak = db(pk);
    rows.push({cue: `${kind}${v}`, peak, rms, vsVoice: rms - voiceRms, ok: peak <= LIM.peak && rms - voiceRms <= -LIM.belowVoice});
    if (kind === 'tick') break; // tick has one variant
  }
  return rows;
}

if (process.argv[1]?.endsWith('sfxAudit.ts')) {
  const f = process.argv[2];
  let voiceRms = -23; // typical levelled narration when no file is given
  if (f && fs.existsSync(f)) {
    const b = fs.readFileSync(f), n = (b.length - 44) >> 1, x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
    voiceRms = activeRmsDb(x);
  }
  console.log(`voice active RMS ${voiceRms.toFixed(1)} dB`);
  for (const r of audit(voiceRms)) console.log(`${r.ok ? 'ok  ' : 'LOUD'} ${r.cue.padEnd(8)} peak ${r.peak.toFixed(1)} dBFS  rms ${r.rms.toFixed(1)} dB  ${r.vsVoice.toFixed(1)} vs voice`);
}
