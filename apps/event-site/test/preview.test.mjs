import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('localhost preview serves route indexes with CSP, real 404s and no file escape', async () => {
  const { createPreviewServer, parsePreviewArgs } = await import('../scripts/preview.mjs');
  assert.deepEqual(parsePreviewArgs([]), { port: 4173 });
  assert.deepEqual(parsePreviewArgs(['--port', '4180']), { port: 4180 });
  assert.throws(() => parsePreviewArgs(['--host', '0.0.0.0']), /usage/i);
  assert.throws(() => parsePreviewArgs(['--port', '99999']), /port/i);
  const directory = await mkdtemp(join(tmpdir(), 'event-preview-'));
  const outside = await mkdtemp(join(tmpdir(), 'event-preview-outside-'));
  const server = createPreviewServer({ directory });
  try {
    await mkdir(join(directory, 'en'));
    await writeFile(join(directory, 'en/index.html'), '<h1>English</h1>');
    await writeFile(join(directory, '404.html'), '<h1>Not found</h1>');
    await writeFile(join(directory, '_headers'), 'do not serve');
    await writeFile(join(outside, 'private.html'), '<p>Synthetic secret, must never be served</p>');
    await symlink(outside, join(directory, 'outside'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/en/`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<h1>English</h1>');
    assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
    assert.equal((await fetch(`${origin}/en`, { redirect: 'manual' })).status, 308);
    assert.equal((await fetch(`${origin}//en`, { redirect: 'manual' })).status, 404);
    assert.equal((await fetch(`${origin}/%2fen`, { redirect: 'manual' })).status, 404);
    assert.equal((await fetch(`${origin}/missing/`)).status, 404);
    assert.equal((await fetch(`${origin}/_headers`)).status, 404);
    assert.equal((await fetch(`${origin}/outside/private.html`)).status, 404);
    assert.equal((await fetch(`${origin}/en/`, { method: 'POST' })).status, 405);
    assert.equal(await (await fetch(`${origin}/en/`, { method: 'HEAD' })).text(), '');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
