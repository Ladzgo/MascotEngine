// Dev tool: render the illustration contact sheets. usage: npx tsx src/visuals/stills.ts <outDir> [t=3] [accent]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
const root = new URL('../../', import.meta.url).pathname;
const out = process.argv[2] ?? '/tmp/visuals', t = Number(process.argv[3] ?? 3), accent = process.argv[4] ?? '#e4572e';
const serveUrl = await bundle({entryPoint: `${root}src/visuals/gallery.tsx`, publicDir: `${root}assets`, symlinkPublicDir: true});
for (const mode of ['a', 'b', 'stage']) {
  const inputProps = {t, accent, mode};
  const composition = await selectComposition({serveUrl, id: 'Gallery', inputProps});
  await renderStill({composition, serveUrl, output: `${out}/gallery-${mode}-t${t}.png`, inputProps, scale: 0.7});
}
