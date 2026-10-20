import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const example = JSON.parse(await readFile(new URL('../../../config/event.example.json', import.meta.url), 'utf8'));
const load = () => import('../src/config.mjs');
const clone = () => structuredClone(example);

test('public schema preserves explicit uncertainty and rejects private or inconsistent config', async () => {
  const { projectConfig } = await load();
  const result = projectConfig(example);
  assert.equal(result.date.certainty, 'tba');
  assert.equal(result.date.start, null);
  assert.equal(result.venue, null);
  assert.equal(result.status, 'example');
  assert.deepEqual(result.benefits, []);
  assert.notEqual(result, example);
  for (const [key, value] of [['owners', ['private@example.invalid']], ['env', { SECRET: 'private' }], ['attendees', ['private']]]) {
    assert.throws(() => projectConfig({ ...clone(), [key]: value }), /unknown|public/i);
  }
  for (const date of [
    { certainty: 'confirmed', start: null, timezone: null },
    { certainty: 'tba', start: '2028-01-01T10:00:00Z', timezone: 'UTC' },
    { certainty: 'tentative', start: 'not-a-date', timezone: 'Mars/One' },
    { certainty: 'confirmed', start: '2028-02-30T10:00:00Z', timezone: 'UTC' },
    { certainty: 'confirmed', start: '2028-01-01T10:00:00', timezone: 'UTC' },
    { certainty: 'confirmed', start: '2028-01-01T24:00:00Z', timezone: 'UTC' },
  ]) assert.throws(() => projectConfig({ ...clone(), date }), /date|timezone/i);
  const confirmed = projectConfig({ ...clone(), date: { certainty: 'confirmed', start: '2028-01-01T10:00:00Z', timezone: 'UTC' } });
  assert.equal(confirmed.date.start, '2028-01-01T10:00:00Z');
});

test('public links and media fail closed, with explicit provider benefit tuples and locale parity', async () => {
  const { projectConfig } = await load();
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.invalid', '//example.invalid', 'https://user:pass@example.invalid', '/%2f/evil', '/a/../b', '/path?x=1', '/path\\\\evil', ' https://example.invalid']) {
    for (const key of ['rsvpUrl', 'feedbackUrl', 'privacyUrl', 'contactUrl']) {
      assert.throws(() => projectConfig({ ...clone(), [key]: url }), /url|link/i, `${key}: ${url}`);
    }
    assert.throws(() => projectConfig({ ...clone(), resources: [{ label: { es: 'Prueba', en: 'Test' }, url }] }), /url|link/i);
  }
  assert.throws(() => projectConfig({ ...clone(), resources: [{ label: { es: 'Solo español' }, url: 'https://example.invalid' }] }), /en/);
  assert.throws(() => projectConfig({ ...clone(), slides: [] }), /slides/);
  assert.throws(() => projectConfig({ ...clone(), recap: { ...clone().recap, owners: ['private'] } }), /unknown/);
  const benefit = { provider: 'Example provider', offer: { es: 'Oferta confirmada por operador', en: 'Operator-confirmed offer' }, eligibility: { es: 'Consultar condiciones', en: 'Review terms' }, termsUrl: 'https://example.invalid/terms', confirmed: true };
  assert.equal(projectConfig({ ...clone(), benefits: [benefit] }).benefits[0].provider, benefit.provider);
  assert.throws(() => projectConfig({ ...clone(), benefits: [{ ...benefit, confirmed: false }] }), /confirmed/);
  const photo = { imagePath: '/media/example.webp', alt: { es: 'Descripción', en: 'Description' }, caption: { es: 'Pie de foto', en: 'Caption' }, credit: { es: 'Autor con permiso', en: 'Creator with permission' }, sourceUrl: 'https://example.invalid/original', permissionGranted: true, subjectConsentConfirmed: true };
  assert.equal(projectConfig({ ...clone(), gallery: [photo] }).gallery[0].imagePath, photo.imagePath);
  for (const bad of [{ permissionGranted: false }, { subjectConsentConfirmed: false }, { sourceUrl: null }, { imagePath: '/media/../secret.png' }, { imagePath: 'https://example.invalid/photo.png' }, { imagePath: '/media/file.svg' }]) {
    assert.throws(() => projectConfig({ ...clone(), gallery: [{ ...photo, ...bad }] }), /gallery|permission|consent|url/i);
  }
});
