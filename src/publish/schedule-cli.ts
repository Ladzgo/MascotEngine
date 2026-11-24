import fs from 'node:fs';
import path from 'node:path';
import {scheduleRows, toCsv} from './scheduleExport.js';

const root = new URL('../../', import.meta.url).pathname;
const out = process.argv[2] && !process.argv[2].startsWith('-') ? path.resolve(process.argv[2]) : path.join(root, 'out', 'schedule.csv');
const rows = await scheduleRows(root);
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, toCsv(rows));
console.log(`SCHEDULE_OK ${out} (${rows.length} rows: ${rows.filter(r => r.kind === 'episode').length} episodes, ${rows.filter(r => r.kind === 'short').length} shorts, ${rows.filter(r => r.kind === 'clip').length} clips)`);
