import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

export type Stage = 'draft' | 'voice' | 'direct' | 'preview' | 'qa';
export type StageResult = {stage: Stage; ok: boolean; sec: number; error?: string};
export type ItemReport = {topic: string; id: string; ok: boolean; stages: StageResult[]; skipped?: string};
export type Report = {startedAt: string; finishedAt?: string; channel: string; engine: string; items: ItemReport[]; ok: number; failed: number};
export type Runner = (args: string[]) => Promise<{code: number; out: string}>;

/** Episode id from a topic: [a-z0-9-], <= 40 chars, unique against `taken`. */
export function slug(topic: string, taken: Set<string>): string {
  const base = topic.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 6).join('-').slice(0, 40).replace(/-+$/, '') || 'episode';
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

/** One topic per line; blank lines and # comments ignored; duplicates dropped. */
export const parseTopics = (text: string) => [...new Set(text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')))];

/** Stage commands as npm script args (the same CLIs the Studio queue wraps). */
export function stageArgs(stage: Stage, o: {topic: string; id: string; channel: string; engine: string}): string[] {
  switch (stage) {
    case 'draft': return ['run', 'draft', '--', o.topic, '--id', o.id, '--channel', o.channel];
    case 'voice': return ['run', 'tts', '--', o.id, '--engine', o.engine];
    case 'direct': return ['run', 'direct', '--', o.id];
    case 'preview': return ['run', 'render', '--', o.id];
    case 'qa': return ['run', 'qa', '--', o.id];
  }
}

/** Runs every topic through draft -> voice -> direct -> preview (+ qa). A failing stage skips only that topic; the report is rewritten after every item. */
export async function runBatch(o: {topics: string[]; channel: string; engine: string; existing?: Set<string>; qa?: boolean; run: Runner; reportFile?: string; log?: (m: string) => void}): Promise<Report> {
  const log = o.log ?? console.log, taken = new Set(o.existing ?? []);
  const rep: Report = {startedAt: new Date().toISOString(), channel: o.channel, engine: o.engine, items: [], ok: 0, failed: 0};
  const save = () => { if (o.reportFile) fs.writeFileSync(o.reportFile, JSON.stringify(rep, null, 2)); };
  const stages: Stage[] = ['draft', 'voice', 'direct', 'preview', ...(o.qa ? ['qa' as Stage] : [])];
  for (const topic of o.topics) {
    const id = slug(topic, taken), item: ItemReport = {topic, id, ok: true, stages: []};
    rep.items.push(item);
    log(`[${rep.items.length}/${o.topics.length}] ${id}: ${topic}`);
    for (const stage of stages) {
      const t0 = Date.now();
      let r: {code: number; out: string};
      try { r = await o.run(stageArgs(stage, {topic, id, channel: o.channel, engine: o.engine})); } catch (e) { r = {code: 1, out: (e as Error).message}; }
      const res: StageResult = {stage, ok: r.code === 0, sec: Math.round((Date.now() - t0) / 100) / 10};
      if (!res.ok) res.error = r.out.split('\n').filter(l => l.trim() && !l.startsWith('>')).slice(-1)[0] ?? `exit ${r.code}`;
      item.stages.push(res);
      log(`  ${stage}: ${res.ok ? 'ok' : 'FAILED ' + res.error} (${res.sec}s)`);
      // QA failing is a finding, not a pipeline failure; every other failure stops this topic
      if (!res.ok && stage !== 'qa') { item.ok = false; break; }
    }
    item.ok ? rep.ok++ : rep.failed++;
    save();
  }
  rep.finishedAt = new Date().toISOString();
  save();
  return rep;
}

export const npmRunner = (cwd: string): Runner => args => new Promise(resolve => {
  const p = spawn('npm', args, {cwd, env: process.env});
  let out = '';
  p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
  p.on('error', e => resolve({code: 1, out: e.message}));
  p.on('close', code => resolve({code: code ?? 1, out}));
});

export const existingIds = (root: string) => new Set(fs.existsSync(path.join(root, 'episodes')) ? fs.readdirSync(path.join(root, 'episodes')) : []);
