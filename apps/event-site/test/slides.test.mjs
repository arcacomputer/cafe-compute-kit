import test from 'node:test';
import assert from 'node:assert/strict';

test('deck navigation bounds keyboard moves and preserves meaningful hash selection', async () => {
  const { nextSlide, slideFromHash } = await import('../public/assets/slides.mjs');
  assert.equal(nextSlide(0, 4, 'ArrowRight'), 1);
  assert.equal(nextSlide(0, 4, ' '), 1);
  assert.equal(nextSlide(0, 4, 'ArrowLeft'), 0);
  assert.equal(nextSlide(3, 4, 'ArrowRight'), 3);
  assert.equal(nextSlide(1, 4, 'End'), 3);
  assert.equal(nextSlide(2, 4, 'Home'), 0);
  assert.equal(nextSlide(2, 4, 'PageUp'), 1);
  assert.equal(nextSlide(2, 4, 'PageDown'), 3);
  assert.equal(nextSlide(2, 4, 'Tab'), null);
  assert.equal(slideFromHash('#slide-3', 4), 2);
  for (const hash of ['', '#slide-0', '#slide-5', '#slide-02', '#slide-1<script>']) assert.equal(slideFromHash(hash, 4), 0);
});
