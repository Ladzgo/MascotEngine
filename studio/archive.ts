import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Episode ZIP: script, status, notes, audio, art and the director/timing files. Never the renders (build/chunks, mp4).
const KEEP = ['episode.json', 'status.json', 'notes.json', 'audio', 'art', 'build/decisions.json', 'build/timings.json'];
const run = (cmd: string, args: string[], cwd?: string) => spawnSync(cmd, args, {cwd, maxBuffer: 1 << 30});

export function exportEpisodeZip(dir: string): Buffer {
  const files = KEEP.filter(f => fs.existsSync(path.join(dir, f)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-zip-')), out = path.join(tmp, 'ep.zip');
  try {
    const r = run('zip', ['-qr', out, ...files], dir);
    if (r.status !== 0) throw new Error('zip failed');
    return fs.readFileSync(out);
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}

/** Unpack into `dest` (must not exist). Throws a readable Error on bad archives; rejects traversal, absolute paths, symlinks and unknown files. */
export function importEpisodeZip(buf: Buffer, dest: string): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-unzip-'));
  try {
    const zip = path.join(tmp, 'in.zip'); fs.writeFileSync(zip, buf);
    const ls = run('unzip', ['-Z1', zip]);
    if (ls.status !== 0) throw new Error('Not a valid ZIP file.');
    for (const n of ls.stdout.toString().split('\n').filter(Boolean)) {
      if (n.startsWith('/') || n.split('/').includes('..') || !KEEP.some(k => n === k || n.startsWith(`${k}/`) || (n.endsWith('/') && k.startsWith(n)))) throw new Error(`Unexpected file in ZIP: ${n}`);
    }
    const x = path.join(tmp, 'x');
    if (run('unzip', ['-q', zip, '-d', x]).status !== 0) throw new Error('Could not unpack the ZIP.');
    const walk = (d: string) => { for (const e of fs.readdirSync(d)) { const f = path.join(d, e), st = fs.lstatSync(f); if (st.isSymbolicLink()) throw new Error('Symlinks are not allowed in the ZIP.'); if (st.isDirectory()) walk(f); } };
    walk(x);
    if (!fs.existsSync(path.join(x, 'episode.json'))) throw new Error('The ZIP has no episode.json.');
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.cpSync(x, dest, {recursive: true});
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
}
