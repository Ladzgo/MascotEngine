import path from 'node:path';
import {exportSubtitles} from './subtitles.js';

const id = process.argv[2];
if (!id || id.startsWith('-')) { console.error('Usage: npm run subs -- <episode-id>'); process.exit(1); }
try {
  const r = exportSubtitles(path.resolve(new URL('../../', import.meta.url).pathname), id);
  console.log(`SUBS_OK ${r.srt}\n${r.vtt}\n${r.chapters ?? 'no chapters (video too short for YouTube rules: need 3 chapters of 10 s+)'}`);
} catch (e) { console.error(`Subtitle export failed: ${(e as Error).message}`); process.exit(1); }
