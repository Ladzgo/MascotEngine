import {loadChannel} from '../channel/channel.js';
import {fetchHeadlines} from './scout.js';

const ch = loadChannel(process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'default');
const hs = await fetchHeadlines({niche: ch.niche, banned: ch.bannedTopics});
for (const h of hs) console.log(`${h.title} (${h.source})\n  ${h.url}`);
if (!hs.length) console.error('No headlines (offline?).');
