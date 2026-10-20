import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const example = JSON.parse(await readFile(new URL('../../../config/event.example.json', import.meta.url), 'utf8'));

test('bilingual route and resource contracts escape content and keep templates honest', async () => {
  const { renderSite } = await import('../src/render.mjs');
  const { copy } = await import('../src/locales.mjs');
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort());
  const input = structuredClone(example);
  input.title.en = '<script>alert("unsafe")</script>';
  const pages = renderSite(input);
  for (const locale of ['es', 'en']) {
    const prefix = locale === 'es' ? '/' : '/en/';
    for (const part of ['', 'resources/', 'slides/', 'recap/', 'gallery/', 'privacy/']) {
      const html = pages.get(`${prefix}${part}index.html`);
      assert.ok(html, `missing ${prefix}${part}`);
      assert.ok(html.includes(`<html lang="${locale}">`));
      assert.match(html, /<main id="main"/);
      assert.match(html, /hreflang="es"/);
      assert.match(html, /hreflang="en"/);
      assert.match(html, /href="\/assets\/site.css"/);
      assert.doesNotMatch(html, /<script>alert|\sonclick=|https?:\/\/[^" ]+\.(?:css|js|woff)/);
    }
    const resources = pages.get(`${prefix}resources/index.html`);
    for (const token of ['CEREBRAS_API_KEY', 'MODEL_ID', 'https://api.cerebras.ai/v1/chat/completions', 'read -rs', 'JSON.stringify', '401', '429']) assert.ok(resources.includes(token), token);
    assert.ok(resources.includes(copy[locale].docsChecked));
    const deck = pages.get(`${prefix}slides/index.html`);
    assert.equal((deck.match(/class="slide"/g) || []).length, input.slides.length);
    assert.match(deck, /data-slide-prev/);
    assert.match(deck, /data-slide-next/);
    assert.match(deck, /data-fullscreen/);
    assert.match(deck, /aria-live="polite"/);
    const recap = pages.get(`${prefix}recap/index.html`);
    assert.ok(recap.includes(copy[locale].recapEmpty));
    const gallery = pages.get(`${prefix}gallery/index.html`);
    assert.ok(gallery.includes(copy[locale].galleryEmpty));
    assert.doesNotMatch(gallery, /<img[^>]*\/media\//);
  }
  assert.match(pages.get('/en/index.html'), /&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;/);
  assert.ok(pages.get('/404.html'));
});
