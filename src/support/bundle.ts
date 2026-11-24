import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {checkReadiness} from '../doctor/doctor.js';
import {redact, secretValues} from './redact.js';

const tail = (f: string, n: number) => { try { return fs.readFileSync(f, 'utf8').split('\n').slice(-n).join('\n'); } catch { return '(none)'; } };

/** One redacted text report: system, doctor result, Studio log tail, recent job errors. */
export async function buildBundle(root: string): Promise<string> {
  let envFile: Record<string, string> = {};
  try { for (const l of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) envFile[m[1]] = m[2]; } } catch { /* no .env */ }
  const secrets = secretValues({...process.env, ...envFile});
  const r = await checkReadiness();
  const jobs = (() => { try { return (JSON.parse(fs.readFileSync(path.join(root, 'data/jobs.json'), 'utf8')) as {episode: string; status: string; error?: string; log: string[]}[]).filter(j => j.status === 'error').slice(-5); } catch { return []; } })();
  const text = [
    `# Mascot Engine support bundle ${new Date().toISOString()}`,
    `node ${process.version} · ${os.platform()} ${os.release()} ${os.arch()}`,
    '', '## Doctor', ...r.items.map(i => `${i.ok ? 'OK ' : i.required ? 'BAD' : 'opt'} ${i.label}${i.ok ? ` (${i.detail})` : `: ${i.fix}`}`),
    '', '## Studio log (last 200 lines)', tail(path.join(root, 'data/logs/studio.log'), 200),
    '', '## Recent failed runs', ...jobs.map(j => `${j.episode}: ${j.error}\n${j.log.slice(-20).join('\n')}`),
  ].join('\n');
  return redact(text, secrets);
}
