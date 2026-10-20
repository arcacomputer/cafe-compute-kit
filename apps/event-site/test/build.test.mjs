import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const example = JSON.parse(await readFile(new URL('../../../config/event.example.json', import.meta.url), 'utf8'));

test('build plan is deterministic, app-local, config-explicit and safe for combined feedback paths', async () => {
  const { parseArgs, createOutputPlan, DEFAULT_CONFIG, DIST } = await import('../scripts/build.mjs');
  assert.ok(DEFAULT_CONFIG.endsWith('/config/event.example.json'));
  assert.ok(DIST.endsWith('/apps/event-site/dist'));
  assert.deepEqual(parseArgs(['--config', 'custom.json']), { config: 'custom.json' });
  for (const args of [['--secret', 'no'], ['--config'], ['--config', 'a', '--config', 'b']]) assert.throws(() => parseArgs(args), /argument|config|usage/i);
  const output = await createOutputPlan(example);
  assert.equal(output.get('/index.html'), (await createOutputPlan(example)).get('/index.html'));
  for (const path of ['/assets/site.css', '/assets/slides.mjs', '/assets/mark.svg', '/assets/table-notes.svg', '/_headers']) assert.ok(output.get(path), path);
  assert.ok(![...output.keys()].some(path => path.startsWith('/feedback/') || path.startsWith('/en/feedback/')));
  const headers = output.get('/_headers');
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /connect-src 'none'/);
  assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(headers, /\/en\/\*|\/feedback/);
  assert.doesNotMatch(output.get('/assets/site.css'), /@import|url\(https?:/);
  assert.match(output.get('/assets/site.css'), /prefers-reduced-motion/);
  assert.match(output.get('/assets/site.css'), /@media print/);
});

test('gallery filesystem boundary rejects symlinked roots and symlinked image files', async () => {
  const { approvedMediaPath } = await import('../scripts/build.mjs');
  assert.equal(typeof approvedMediaPath, 'function');
  const directory = await mkdtemp(join(tmpdir(), 'event-media-'));
  try {
    const root = join(directory, 'media');
    await mkdir(root);
    await writeFile(join(root, 'original.webp'), 'synthetic fixture, not a published image');
    assert.equal(await approvedMediaPath(root, join(root, 'original.webp')), join(root, 'original.webp'));
    await symlink(root, join(directory, 'linked-root'));
    await assert.rejects(() => approvedMediaPath(join(directory, 'linked-root'), join(directory, 'linked-root/original.webp')), /regular|symlink/i);
    await symlink(join(root, 'original.webp'), join(root, 'linked.webp'));
    await assert.rejects(() => approvedMediaPath(root, join(root, 'linked.webp')), /regular|symlink/i);
    await writeFile(join(directory, 'outside.webp'), 'synthetic private data');
    await assert.rejects(() => approvedMediaPath(root, join(directory, 'outside.webp')), /outside|boundary|local/i);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
