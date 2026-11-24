#!/bin/bash
# Export the code mascot (src/character/Mascot.tsx) as transparent 1200x1500 PNGs, one per pose
# plus <pose>_talk.png (mouth open), using remotion bundle() + renderStill() once for all.
#
#   scripts/export-poses.sh [--out DIR] [--accent #rrggbb] [--install]
#
# Default DIR is design/mascot/export. Files only go to assets/character with --install:
# NOTE that PNGs there override the code mascot and freeze the accent colour (tie) for good.
# Exports are clean (boil filter disabled; the scene applies its own boil). Feet at the bottom.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="design/mascot/export"; ACCENT="#d9482b"
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="$2"; shift 2;;
    --accent) ACCENT="$2"; shift 2;;
    --install) OUT="assets/character"; shift;;
    *) echo "unknown arg $1"; exit 1;;
  esac
done
mkdir -p "$OUT"
TMP="scripts/.export-tmp"; mkdir -p "$TMP"; trap 'rm -rf "$TMP"' EXIT
cat > "$TMP/entry.tsx" <<'TSX'
import React from 'react';
import {Composition, registerRoot, AbsoluteFill} from 'remotion';
import {Mascot} from '../../src/character/Mascot';
const Pose: React.FC<{pose: string; talking: boolean; accent: string}> = ({pose, talking, accent}) => (
  <AbsoluteFill>
    <svg width={0} height={0} style={{position: 'absolute'}}><defs><filter id="boil"><feOffset dx={0} dy={0} /></filter></defs></svg>
    <Mascot pose={pose} talking={talking} accent={accent} frame={0} height={1500} assets={{}} enter={1} />
  </AbsoluteFill>
);
registerRoot(() => <Composition id="Pose" component={Pose} width={1200} height={1500} fps={30} durationInFrames={1} defaultProps={{pose: 'neutral', talking: false, accent: '#d9482b'}} />);
TSX
cat > "$TMP/run.ts" <<'TS'
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {POSE_NAMES} from '../../src/character/Mascot';
const [out, accent] = [process.argv[2], process.argv[3]];
const serveUrl = await bundle({entryPoint: path.resolve('scripts/.export-tmp/entry.tsx')});
for (const pose of POSE_NAMES) for (const talking of [false, true]) {
  const inputProps = {pose, talking, accent};
  const composition = await selectComposition({serveUrl, id: 'Pose', inputProps});
  const output = path.resolve(out, `${pose}${talking ? '_talk' : ''}.png`);
  await renderStill({composition, serveUrl, inputProps, output, imageFormat: 'png'});
  console.log(output);
}
TS
npx tsx "$TMP/run.ts" "$OUT" "$ACCENT"
