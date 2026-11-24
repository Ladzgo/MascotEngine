import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toCsv, type Row} from './scheduleExport.js';

test('toCsv: header, quotes, commas and newlines survive', () => {
  const r: Row = {kind: 'episode', title: 'Why, "quoted" titles', description: 'line1\nline2', tags: 'a;b', file: '/x/y.mp4', language: 'hu', scheduledFor: '', episode: 'ep1'};
  const csv = toCsv([r]);
  const [head, ...rest] = csv.split('\r\n');
  assert.equal(head, 'title,description,tags,file,language,scheduledFor,kind,episode');
  assert.match(rest.join('\r\n'), /^"Why, ""quoted"" titles","line1\nline2",a;b,\/x\/y\.mp4,hu,,episode,ep1/);
});
