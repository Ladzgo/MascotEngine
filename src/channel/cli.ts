import {parseArgs} from 'node:util';
import {fromPreset, PRESETS} from './presets.js';
import {Channel, listChannels, loadChannel, saveChannel, channelContext} from './channel.js';

const {values, positionals} = parseArgs({
  allowPositionals: true,
  options: {
    name: {type: 'string'}, description: {type: 'string'}, niche: {type: 'string'},
    audience: {type: 'string'}, tone: {type: 'string'}, voice: {type: 'string'}, preset: {type: 'string'},
  },
});
const [cmd, id] = positionals;
function die(m: string): never { console.error(m); process.exit(1); }

try {
  if (cmd === 'list') {
    for (const c of listChannels()) console.log(`${c.id}\t${c.name}\t${c.niche}`);
  } else if (cmd === 'show' && id) {
    const c = loadChannel(id);
    console.log(JSON.stringify(c, null, 2) + '\n\n' + channelContext(c));
  } else if (cmd === 'create' && id) {
    if (!values.name && !values.preset) die('--name or --preset <' + Object.keys(PRESETS).join('|') + '> is required');
    try { loadChannel(id); die(`Channel ${id} already exists`); } catch (e) { if (!/not found/.test((e as Error).message)) throw e; }
    if (values.preset) saveChannel(fromPreset(values.preset, id, {name: values.name}));
    else saveChannel(Channel.parse({
      id, name: values.name!, description: values.description ?? '', niche: values.niche ?? '',
      audience: values.audience ?? '', tone: values.tone ?? '', voiceId: values.voice,
    }));
    console.log(`CHANNEL_OK ${id}`);
  } else if (cmd === 'presets') {
    for (const [k, p] of Object.entries(PRESETS)) console.log(`${k}\t${p.name}\t${p.niche}\taccent ${p.accent}`);
  } else die('Usage: npm run channel -- list | presets | show <id> | create <id> (--preset <name> | --name ... --description ...)');
} catch (e) { die((e as Error).message); }
