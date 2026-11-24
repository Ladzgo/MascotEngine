try { process.loadEnvFile(); } catch { /* .env optional */ }
import {checkReadiness} from './doctor.js';

const {ok, items} = await checkReadiness();
for (const i of items) console.log(`${i.ok ? 'OK     ' : i.required ? 'MISSING' : 'WARN   '} ${i.label.padEnd(34)} ${i.ok ? i.detail : i.fix}`);
const miss = items.filter(i => !i.ok);
console.log(`\n${ok ? 'Ready to render.' : 'NOT ready: required items are missing.'} ${miss.length ? `${miss.length} item(s) to fix (WARN = optional features degrade, see the fix).` : 'Everything is in place.'}`);
process.exit(ok ? 0 : 1);
