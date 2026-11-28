import React from 'react';
import {Img, staticFile} from 'remotion';
import {Shadow, pop, wave} from './kit';
import {OBJECTS, type Obj} from './objects';
import {assetFile} from './assetPick';
import {drainObj, flagObj, tagsObj} from './entities';

// A library asset (Fluent 3D PNG) drawn like the procedural objects: same 400 box, ground shadow, pop-in and a slow float.
// A missing file (assets/lib is fetched locally, not in git/CI) renders nothing instead of failing the render.
const cache = new Map<string, Obj>();
const make = (file: string): Obj => ({t}) => {
  const [failed, setFailed] = React.useState(false);
  const s = Math.max(0.01, pop(t, 0, 0.5));
  return (
    <g>
      <Shadow rx={100} o={failed ? 0 : 1} />
      <g transform={`translate(200 330) scale(${s}) rotate(${wave(t, 3.4) * 3}) translate(-200 -330) translate(0 ${wave(t, 2.6) * 6})`}>
        {!failed && <foreignObject x={70} y={70} width={260} height={260}><Img src={staticFile(file)} maxRetries={0} onError={() => setFailed(true)} style={{width: '100%', height: '100%', objectFit: 'contain'}} /></foreignObject>}
      </g>
    </g>
  );
};
/** Renderer for a planned kind: a procedural object, or `asset:<id>` from the library. */
export function objectOf(kind: string): Obj | undefined {
  if (OBJECTS[kind]) return OBJECTS[kind];
  if (kind.startsWith('flag:')) return flagObj(kind.slice(5));
  if (kind.startsWith('tags:')) return tagsObj(kind.slice(5));
  if (kind.startsWith('drain:')) return drainObj(kind.slice(6));
  if (!kind.startsWith('asset:')) return undefined;
  const file = assetFile(kind.slice(6)); if (!file) return undefined;
  if (!cache.has(file)) cache.set(file, make(file));
  return cache.get(file);
}
