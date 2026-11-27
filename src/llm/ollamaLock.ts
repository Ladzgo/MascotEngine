// One Ollama job at a time across processes (drafts, Studio stock picks, semantic QA): a lock file in data/.
// Ollama serialises requests anyway, but two models (text 7B + vision 7B) evicting each other made both sides stall for minutes.
// Usage: await withOllamaLock('stock-vlm', () => fetch(...)). The lock is re-entrant per process and stale after 10 min or a dead pid.
import fs from 'node:fs';
import path from 'node:path';

export const OLLAMA_LOCK = path.join(new URL('../../', import.meta.url).pathname, 'data/ollama.lock');
const STALE_MS = 10 * 60 * 1000;
let depth = 0;

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
function tryTake(file: string, who: string): boolean {
  try {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify({pid: process.pid, who, at: Date.now()}), {flag: 'wx'});
    return true;
  } catch {
    try { // a crashed holder or an old lock does not block forever
      const cur = JSON.parse(fs.readFileSync(file, 'utf8')) as {pid: number; at: number};
      if (!alive(cur.pid) || Date.now() - cur.at > STALE_MS) { fs.rmSync(file, {force: true}); return tryTake(file, who); }
    } catch { fs.rmSync(file, {force: true}); }
    return false;
  }
}

/** Runs fn while holding data/ollama.lock; waits (polling every 0.5 s, up to `maxWaitMs`) while another process holds it. */
export async function withOllamaLock<T>(who: string, fn: () => Promise<T>, o: {file?: string; maxWaitMs?: number} = {}): Promise<T> {
  const file = o.file ?? process.env.OLLAMA_LOCK_FILE ?? OLLAMA_LOCK;
  if (depth > 0) { depth++; try { return await fn(); } finally { depth--; } }
  const until = Date.now() + (o.maxWaitMs ?? 15 * 60 * 1000);
  while (!tryTake(file, who)) {
    if (Date.now() > until) throw new Error(`Ollama is busy (${file} held by another job for too long)`);
    await new Promise(r => setTimeout(r, 500));
  }
  depth = 1;
  try { return await fn(); } finally { depth = 0; fs.rmSync(file, {force: true}); }
}
