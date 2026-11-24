import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import {checkRequest, underRoots} from './guard.js';

const ok = {host: 'localhost:4177', method: 'POST', url: '/api/make', contentType: 'application/json', contentLength: '20'};
test('checkRequest: host, origin, content type', () => {
  assert.equal(checkRequest(ok, 4177), null);
  assert.equal(checkRequest({...ok, host: 'evil.example'}, 4177)?.code, 403);
  assert.equal(checkRequest({...ok, origin: 'http://evil.example'}, 4177)?.code, 403);
  assert.equal(checkRequest({...ok, origin: 'http://127.0.0.1:4177'}, 4177), null);
  assert.equal(checkRequest({...ok, contentType: 'text/plain'}, 4177)?.code, 415);
  assert.equal(checkRequest({...ok, contentType: undefined, contentLength: '0'}, 4177), null); // DELETE / empty POST
  assert.equal(checkRequest({...ok, url: '/api/clips/upload?name=a.mp4', contentType: 'video/mp4'}, 4177), null);
  assert.equal(checkRequest({...ok, url: '/api/episodes/ep1/audio/3?ext=wav', contentType: 'audio/wav'}, 4177), null);
  assert.equal(checkRequest({...ok, method: 'GET', url: '/api/readiness', origin: 'http://evil.example'}, 4177), null);
});
test('underRoots resolves symlinks and ..', () => {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'g-')), a = path.join(t, 'a'), b = path.join(t, 'b');
  fs.mkdirSync(a); fs.mkdirSync(b); fs.writeFileSync(path.join(a, 'v.mp4'), 'x'); fs.writeFileSync(path.join(b, 'v.mp4'), 'x'); fs.symlinkSync(path.join(b, 'v.mp4'), path.join(a, 'link.mp4'));
  assert.ok(underRoots(path.join(a, 'v.mp4'), [a]));
  assert.ok(!underRoots(path.join(a, 'link.mp4'), [a]));
  assert.ok(!underRoots(path.join(a, '..', 'b', 'v.mp4'), [a]));
  assert.ok(!underRoots(path.join(a, 'missing.mp4'), [a]));
});
