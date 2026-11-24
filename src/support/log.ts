import fs from 'node:fs';
import path from 'node:path';

/** Local crash log (data/logs/studio.log). Nothing leaves the machine. Rotates at 1 MB. */
export function logLine(root: string, kind: string, msg: string): void {
  try {
    const dir = path.join(root, 'data/logs'), f = path.join(dir, 'studio.log');
    fs.mkdirSync(dir, {recursive: true});
    if (fs.existsSync(f) && fs.statSync(f).size > 1_000_000) fs.renameSync(f, `${f}.1`);
    fs.appendFileSync(f, `${new Date().toISOString()} [${kind}] ${msg.replace(/\n/g, '\n  ')}\n`);
  } catch { /* logging must never crash the app */ }
}
