import test from 'node:test';
import assert from 'node:assert/strict';

test('public origin is explicitly configured and rejects paths and insecure hosts', async () => {
  const { getConfig } = await import('./config.js');
  const config = getConfig({ PUBLIC_ORIGIN: 'https://feedback.example.test', OWNER_EMAILS: 'owner@example.test', EVENT_NAME: 'Synthetic meetup' });
  assert.equal(config.origin, 'https://feedback.example.test');
  assert.deepEqual(config.owners, ['owner@example.test']);
  for (const PUBLIC_ORIGIN of [undefined, 'http://example.test', 'https://example.test/path', 'https://u:p@example.test', 'https://example.test?x=1']) assert.throws(() => getConfig({ PUBLIC_ORIGIN }));
});
