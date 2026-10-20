// Shared local-only picker. Submission and photo normalization belong to form.js.
(() => {
  const form = document.querySelector('#feedback-form');
  const input = document.querySelector('#photos');
  const zone = document.querySelector('#photo-drop');
  if (!form || !input || !zone || form.photoPicker) return;
  const list = document.querySelector('#photo-list');
  const status = document.querySelector('#photo-status');
  const es = document.documentElement.lang === 'es';
  const selected = [];
  const say = text => { status.textContent = text; };
  const render = () => {
    list.replaceChildren();
    selected.forEach((item, index) => {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = item.url; img.alt = ''; img.width = 96; img.height = 72;
      const name = document.createElement('span'); name.textContent = item.file.name;
      const remove = document.createElement('button'); remove.type = 'button';
      remove.textContent = es ? 'Quitar' : 'Remove';
      remove.setAttribute('aria-label', `${remove.textContent}: ${item.file.name}`);
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(item.url); selected.splice(index, 1); render();
        say(es ? 'Foto quitada.' : 'Photo removed.');
        (list.querySelector('button') || input).focus();
      });
      li.append(img, name, remove); list.append(li);
    });
  };
  const add = files => {
    if (input.disabled || input.closest('fieldset')?.disabled) return;
    const batch = Array.from(files);
    if (selected.length + batch.length > 20) { say(es ? 'Puedes seleccionar hasta 20 fotos. Quita una antes de añadir más.' : 'Select up to 20 photos. Remove one before adding more.'); return; }
    if (batch.some(f => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) { say(es ? 'Usa fotos JPEG, PNG o WebP.' : 'Use JPEG, PNG or WebP photos.'); return; }
    if (batch.some(f => f.size > 4 * 1024 * 1024)) { say(es ? 'Cada foto debe pesar como máximo 4 MB.' : 'Each photo must be 4 MB or smaller.'); return; }
    batch.forEach(file => selected.push({file, url: URL.createObjectURL(file)}));
    render();
    say(es ? `${selected.length} de 20 fotos seleccionadas.` : `${selected.length} of 20 photos selected.`);
  };
  const reset = () => {
    selected.forEach(item => URL.revokeObjectURL(item.url)); selected.length = 0;
    input.value = ''; render(); say(''); zone.classList.remove('drag-over');
  };
  form.photoPicker = {getFiles: () => selected.map(item => item.file), reset};
  input.addEventListener('change', () => { add(input.files); input.value = ''; });
  for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, event => {
    event.preventDefault();
    if (!input.closest('fieldset')?.disabled) { event.dataTransfer.dropEffect = 'copy'; zone.classList.add('drag-over'); }
  });
  zone.addEventListener('dragleave', event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('drag-over'); add(event.dataTransfer.files); });
  form.addEventListener('reset', reset);
  window.addEventListener('pagehide', reset);
})();
