import fs from 'node:fs';
import path from 'node:path';
import {buildBundle} from './bundle.js';

const root = path.resolve(new URL('../../', import.meta.url).pathname);
const file = path.join(root, 'out', `support-bundle-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
fs.mkdirSync(path.dirname(file), {recursive: true});
fs.writeFileSync(file, await buildBundle(root));
console.log(`Support bundle (secrets removed, review before sharing): ${file}`);
