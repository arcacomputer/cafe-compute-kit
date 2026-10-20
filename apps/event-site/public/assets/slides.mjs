// Original, dependency-free deck controller. All slides remain readable without JS.
export function nextSlide(current, count, key) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(key)) return Math.min(count - 1, current + 1);
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) return Math.max(0, current - 1);
  return null;
}
export function slideFromHash(hash, count) {
  const match = /^#slide-([1-9]\d*)$/.exec(hash);
  const index = match ? Number(match[1]) - 1 : 0;
  return index >= 0 && index < count ? index : 0;
}

export function initDeck(deck, doc = document, win = window) {
  const slides = [...deck.querySelectorAll('.slide')];
  if (!slides.length) return;
  const prev = deck.querySelector('[data-slide-prev]');
  const next = deck.querySelector('[data-slide-next]');
  const status = deck.querySelector('[data-slide-status]');
  const fullscreen = deck.querySelector('[data-fullscreen]');
  const message = deck.querySelector('[data-deck-message]');
  let current = slideFromHash(win.location.hash, slides.length);
  const show = (index, focus = false, updateHash = true) => {
    current = index;
    slides.forEach((slide, i) => { slide.hidden = i !== current; });
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    status.textContent = `${deck.dataset.slideLabel} ${current + 1} ${deck.dataset.ofLabel} ${slides.length}`;
    if (updateHash) win.history.replaceState(null, '', `#slide-${current + 1}`);
    if (focus) slides[current].querySelector('h2').focus({ preventScroll: true });
  };
  const toggleFullscreen = async () => {
    message.textContent = '';
    try {
      if (doc.fullscreenElement === deck) await doc.exitFullscreen();
      else if (deck.requestFullscreen) await deck.requestFullscreen();
      else message.textContent = deck.dataset.fullscreenError;
    } catch { message.textContent = deck.dataset.fullscreenError; }
  };
  prev.addEventListener('click', () => show(Math.max(0, current - 1), true));
  next.addEventListener('click', () => show(Math.min(slides.length - 1, current + 1), true));
  fullscreen.addEventListener('click', toggleFullscreen);
  deck.querySelector('[data-print]').addEventListener('click', () => win.print());
  doc.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = doc.fullscreenElement === deck ? deck.dataset.fullscreenExit : deck.dataset.fullscreenEnter;
  });
  doc.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented || event.target.closest('input, textarea, select, button, a, summary, [contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); void toggleFullscreen(); return; }
    const index = nextSlide(current, slides.length, event.key);
    if (index !== null) { event.preventDefault(); show(index, true); }
  });
  win.addEventListener('hashchange', () => show(slideFromHash(win.location.hash, slides.length), true, false));
  deck.dataset.enhanced = 'true';
  deck.querySelector('.deck-controls').hidden = false;
  show(current);
}
if (typeof document !== 'undefined') {
  const deck = document.querySelector('[data-deck]');
  if (deck) initDeck(deck);
}
