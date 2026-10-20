const fail = (path, reason) => { throw new TypeError(`${path}: ${reason}`); };
export function object(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field; public configuration only');
  return value;
}
export function text(value, path, max = 5000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(path, 'expected nonempty public text');
  return value;
}
export function bilingual(value, path) {
  object(value, ['es', 'en'], path);
  return { es: text(value.es, `${path}.es`), en: text(value.en, `${path}.en`) };
}
function dateConfig(value) {
  object(value, ['certainty', 'start', 'timezone'], 'date');
  if (!['tba', 'tentative', 'confirmed'].includes(value.certainty)) fail('date.certainty', 'expected tba, tentative or confirmed');
  if (value.certainty === 'tba') {
    if (value.start !== null || value.timezone !== null) fail('date', 'TBA requires null start and timezone');
  } else {
    // An explicit offset and a real calendar date are required; Date.parse alone normalizes Feb 30.
    if (typeof value.start !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value.start) || !Number.isFinite(Date.parse(value.start))) fail('date.start', 'expected ISO timestamp with offset');
    const [hour, minute, second] = value.start.slice(11, 19).split(':').map(Number);
    if (hour > 23 || minute > 59 || second > 59) fail('date.start', 'invalid time of day');
    const [year, month, day] = value.start.slice(0, 10).split('-').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) fail('date.start', 'invalid calendar date');
    text(value.timezone, 'date.timezone', 100);
    try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }); } catch { fail('date.timezone', 'invalid IANA timezone'); }
  }
  return { certainty: value.certainty, start: value.start, timezone: value.timezone };
}
export function publicUrl(value, path, { local = false, nullable = false } = {}) {
  if (value === null && nullable) return null;
  text(value, `${path}.url`, 2048);
  if (value !== value.trim() || /[\s\\\u0000-\u001f]/.test(value)) fail(path, 'invalid URL');
  if (local && /^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(value)) return value;
  let url;
  try { url = new URL(value); } catch { fail(path, 'expected HTTPS URL or clean local route'); }
  if (url.protocol !== 'https:' || !value.startsWith('https://') || !url.hostname || url.username || url.password) fail(path, 'expected HTTPS URL without credentials');
  return value;
}
function list(value, path, mapper, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.length > 100) fail(path, `expected ${minimum}–100 items`);
  return value.map((item, index) => mapper(item, `${path}[${index}]`));
}
function publicLink(value, path) {
  object(value, ['label', 'url'], path);
  return { label: bilingual(value.label, `${path}.label`), url: publicUrl(value.url, `${path}.url`) };
}
function biEntry(value, path, fields) {
  object(value, fields, path);
  return Object.fromEntries(fields.map(key => [key, bilingual(value[key], `${path}.${key}`)]));
}
const keys = ['version', 'status', 'title', 'location', 'audience', 'intro', 'date', 'venue', 'rsvpUrl', 'feedbackUrl', 'privacyUrl', 'contactUrl', 'resources', 'social', 'benefits', 'preparation', 'slides', 'recap', 'gallery', 'privacy'];
export function projectConfig(input) {
  object(input, keys, 'event');
  if (input.version !== 1) fail('version', 'expected 1');
  if (!['example', 'planning', 'confirmed', 'completed'].includes(input.status)) fail('status', 'invalid event status');
  // Construct every published property explicitly. Never spread input or serialize process.env.
  const result = { version: 1, status: input.status, date: dateConfig(input.date) };
  if (['confirmed', 'completed'].includes(input.status) && result.date.certainty !== 'confirmed') fail('date', 'confirmed/completed event requires confirmed date');
  for (const key of ['title', 'location', 'audience', 'intro', 'privacy']) result[key] = bilingual(input[key], key);
  result.venue = input.venue === null ? null : bilingual(input.venue, 'venue');
  for (const key of ['rsvpUrl', 'feedbackUrl', 'privacyUrl', 'contactUrl']) result[key] = publicUrl(input[key], key, { local: true, nullable: ['rsvpUrl', 'feedbackUrl', 'contactUrl'].includes(key) });
  result.resources = list(input.resources, 'resources', publicLink);
  result.social = list(input.social, 'social', publicLink);
  result.preparation = list(input.preparation, 'preparation', (v, p) => biEntry(v, p, ['title', 'body']));
  result.slides = list(input.slides, 'slides', (v, p) => biEntry(v, p, ['title', 'body', 'notes']), 1);
  object(input.recap, ['summary', 'takeaways', 'nextSteps'], 'recap');
  result.recap = {
    summary: input.recap.summary === null ? null : bilingual(input.recap.summary, 'recap.summary'),
    takeaways: list(input.recap.takeaways, 'recap.takeaways', bilingual),
    nextSteps: list(input.recap.nextSteps, 'recap.nextSteps', bilingual),
  };
  result.benefits = list(input.benefits, 'benefits', (v, p) => {
    object(v, ['provider', 'offer', 'eligibility', 'termsUrl', 'confirmed'], p);
    if (v.confirmed !== true) fail(`${p}.confirmed`, 'publish only an explicitly confirmed benefit');
    return { provider: text(v.provider, `${p}.provider`, 100), offer: bilingual(v.offer, `${p}.offer`), eligibility: bilingual(v.eligibility, `${p}.eligibility`), termsUrl: publicUrl(v.termsUrl, `${p}.termsUrl`), confirmed: true };
  });
  result.gallery = list(input.gallery, 'gallery', (v, p) => {
    object(v, ['imagePath', 'alt', 'caption', 'credit', 'sourceUrl', 'permissionGranted', 'subjectConsentConfirmed'], p);
    if (v.permissionGranted !== true || v.subjectConsentConfirmed !== true) fail(p, 'image permission and subject consent must be explicitly confirmed');
    if (typeof v.imagePath !== 'string' || !/^\/media\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:png|jpg|jpeg|webp|avif)$/.test(v.imagePath)) fail(p, 'expected a safe /media/ raster image path');
    return { imagePath: v.imagePath, alt: bilingual(v.alt, `${p}.alt`), caption: bilingual(v.caption, `${p}.caption`), credit: bilingual(v.credit, `${p}.credit`), sourceUrl: publicUrl(v.sourceUrl, `${p}.sourceUrl`), permissionGranted: true, subjectConsentConfirmed: true };
  });
  return result;
}
