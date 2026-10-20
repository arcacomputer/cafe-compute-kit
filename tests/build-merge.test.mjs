import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const modulePath = path.resolve('scripts/build.mjs');
test('combined build preserves both app outputs and refuses unexpected collisions', async () => {
  let exists = true;
  try { await readFile(modulePath); } catch { exists = false; }
  assert.equal(exists, true, 'Combined builder is not implemented');
  const { mergeOutputs } = await import(pathToFileURL(modulePath));
  const base = await mkdtemp(path.join(process.env.TMPDIR || tmpdir(), 'event-kit-merge-'));
  try {
    const site = path.join(base, 'site'), feedback = path.join(base, 'feedback'), out = path.join(base, 'dist');
    await mkdir(site); await mkdir(path.join(feedback, 'feedback'), {recursive:true});
    await writeFile(path.join(site, 'index.html'), '<h1>Example event</h1>');
    await writeFile(path.join(feedback, 'feedback', 'form.css'), 'body{color:black}');
    await mergeOutputs([site, feedback], out);
    assert.equal(await readFile(path.join(out, 'index.html'), 'utf8'), '<h1>Example event</h1>');
    assert.equal(await readFile(path.join(out, 'feedback', 'form.css'), 'utf8'), 'body{color:black}');
    await writeFile(path.join(feedback, 'index.html'), '<h1>Unexpected replacement</h1>');
    await assert.rejects(() => mergeOutputs([site, feedback], path.join(base, 'other')), /collision/i);
  } finally { await rm(base, {recursive:true, force:true}); }
});
