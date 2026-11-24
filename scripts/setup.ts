// One-step setup: npm packages, then the readiness check with brew/ollama suggestions. Never downloads models or calls paid APIs.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {checkReadiness} from '../src/doctor/doctor.js';

const root = new URL('../', import.meta.url).pathname;
if (!fs.existsSync(`${root}node_modules/remotion`)) {
  console.log('Installing npm packages (npm ci)...');
  if (spawnSync('npm', ['ci'], {cwd: root, stdio: 'inherit'}).status !== 0) { console.error('npm ci failed.'); process.exit(1); }
}
const {ok, items} = await checkReadiness();
for (const i of items) console.log(`${i.ok ? 'OK     ' : i.required ? 'MISSING' : 'WARN   '} ${i.label.padEnd(34)} ${i.ok ? i.detail : i.fix}`);
const todo = items.filter(i => !i.ok).map(i => i.fix.match(/`([^`]+)`/)?.[1]).filter(Boolean);
if (process.platform === 'darwin' && !spawnSync('which', ['brew']).stdout.length) console.log('\nHomebrew missing: https://brew.sh');
if (todo.length) console.log(`\nRun these (copy, one by one):\n  ${[...new Set(todo)].join('\n  ')}`);
console.log(`\n${ok ? 'Ready. Start the Studio: npm run app (or double-click "Mascot Studio.command").' : 'Not ready yet: fix the MISSING items, then run npm run setup again.'}`);
process.exit(ok ? 0 : 1);
