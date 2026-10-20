import { projectConfig } from './config.mjs';
import { copy } from './locales.mjs';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const e = escapeHtml;
export const route = (locale, part = '') => `${locale === 'en' ? '/en/' : '/'}${part ? `${part}/` : ''}`;
const anchor = (url, label, className = '') => `<a${className ? ` class="${className}"` : ''} href="${e(url)}"${url.startsWith('https:') ? ' rel="noreferrer"' : ''}>${e(label)}</a>`;
const code = value => `<pre tabindex="0"><code>${e(value)}</code></pre>`;
const internalPublicUrl = (url, locale) => locale === 'en' && url === '/privacy/' ? '/en/privacy/' : url;
const heading = (d, title, intro) => `<header class="page-heading"><p class="eyebrow">${e(d.fieldGuide)}</p><h1>${e(title)}</h1><p class="lede">${e(intro)}</p></header>`;

function shell(c, locale, part, title, content) {
  const d = copy[locale];
  const nav = ['', 'resources', 'slides', 'recap', 'gallery'].map(key => `<a href="${route(locale, key)}"${key === part ? ' aria-current="page"' : ''}>${e(d[key || 'home'])}</a>`).join('');
  return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Cafe Compute Kit</title><meta name="description" content="${e(c.audience[locale])}"><meta name="color-scheme" content="light"><link rel="alternate" hreflang="es" href="${route('es', part)}"><link rel="alternate" hreflang="en" href="${route('en', part)}"><link rel="icon" type="image/svg+xml" href="/assets/mark.svg"><link rel="stylesheet" href="/assets/site.css">${part === 'slides' ? '<script type="module" src="/assets/slides.mjs"></script>' : ''}</head>
<body${part === 'slides' ? ' class="deck-page"' : ''}>
<a class="skip" href="#main">${e(d.skip)}</a>
<header class="site-header"><a class="wordmark" href="${route(locale)}"><img src="/assets/mark.svg" width="32" height="32" alt="">Cafe Compute <span>Kit</span></a><nav aria-label="${e(d.nav)}">${nav}</nav><a class="language" href="${route(locale === 'en' ? 'es' : 'en', part)}" lang="${locale === 'en' ? 'es' : 'en'}" aria-label="${e(d.languageLabel)}">${e(d.language)}</a></header>
<main id="main"><div class="status-banner">${e(d[c.status])}</div>${content}</main>
<footer class="site-footer"><div><strong>Cafe Compute Kit</strong><p>${e(d.community)}</p><p class="footer-links">${anchor(internalPublicUrl(c.privacyUrl, locale), d.privacy)} ${c.contactUrl ? anchor(c.contactUrl, d.contact) : e(d.noContact)} ${c.social.map(link => anchor(link.url, link.label[locale])).join(' ')}</p></div><div>${c.feedbackUrl ? `${anchor(c.feedbackUrl, d.feedback)}<p>${e(d.feedbackSeparate)}</p>` : ''}<p class="edition">${e(d.edition)}</p></div></footer>
</body></html>\n`;
}
function dateLabel(c, locale) {
  const d = copy[locale];
  if (c.date.certainty === 'tba') return e(d.tba);
  const value = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { timeZone: c.date.timezone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(c.date.start));
  return `${c.date.certainty === 'tentative' ? `<strong>${e(d.tentative)}</strong><br>` : ''}<time datetime="${e(c.date.start)}">${e(value)}</time>`;
}
function home(c, locale) {
  const d = copy[locale];
  const links = [['resources', d.resourceTeaser], ['slides', d.slideTeaser], ['recap', d.recapTeaser]];
  return `<section class="hero"><div><p class="eyebrow">${e(d.fieldGuide)}</p><h1>${e(c.title[locale])}</h1><p class="audience">${e(c.audience[locale])}</p><p class="lede">${e(c.intro[locale])}</p><div class="actions">${anchor(route(locale, 'resources'), d.start, 'button primary')}${c.rsvpUrl ? anchor(c.rsvpUrl, d.rsvp, 'button') : ''}</div>${c.rsvpUrl ? '' : `<p class="small">${e(d.noRsvp)}</p>`}</div><figure class="hero-art"><img src="/assets/table-notes.svg" alt="" width="480" height="440"><figcaption>${e(c.location[locale])}</figcaption></figure></section>
<section class="event-facts"><h2 class="sr-only">${e(d.home)}</h2><dl><div><dt>${e(d.date)}</dt><dd>${dateLabel(c, locale)}</dd></div><div><dt>${e(d.timezone)}</dt><dd>${e(c.date.timezone || d.tba)}</dd></div><div><dt>${e(d.venue)}</dt><dd>${e(c.venue?.[locale] || d.tba)}</dd></div></dl></section>
<section class="section"><div class="section-heading"><p class="eyebrow">01 / ${e(d.home)}</p><h2>${e(d.preparation)}</h2><p>${e(d.preparationNote)}</p></div><ol class="preparation">${c.preparation.map(item => `<li><h3>${e(item.title[locale])}</h3><p>${e(item.body[locale])}</p></li>`).join('')}</ol></section>
<section class="section link-section"><h2>${e(d.explore)}</h2><div class="guide-links">${links.map(([part, body], i) => `<a href="${route(locale, part)}"><span class="eyebrow">0${i + 2}</span><h3>${e(d[part])}</h3><p>${e(body)}</p><span aria-hidden="true">↗</span></a>`).join('')}</div></section>
<section class="section benefit-section"><h2>${e(d.benefits)}</h2>${c.benefits.length ? `<ul class="plain-list">${c.benefits.map(b => `<li><h3>${e(b.provider)}</h3><p>${e(b.offer[locale])}</p><p>${e(b.eligibility[locale])}</p>${anchor(b.termsUrl, d.terms)}</li>`).join('')}</ul>` : `<p>${e(d.noBenefits)}</p>`}</section>`;
}
const keySetup = `read -rs -p 'CEREBRAS_API_KEY: ' CEREBRAS_API_KEY; printf '\\n'
export CEREBRAS_API_KEY
# Check presence without printing the secret:
test -n "$CEREBRAS_API_KEY" && printf 'Key is set\\n'`;
const modelSetup = `export MODEL_ID='REPLACE_WITH_A_CURRENT_MODEL_ID'`;
const firstRequest = `: "\${CEREBRAS_API_KEY:?Set your key locally first}"
: "\${MODEL_ID:?Choose a model from the official catalog}"
node --input-type=module -e '
  process.stdout.write(JSON.stringify({
    model: process.env.MODEL_ID,
    messages: [{ role: "user", content: "Suggest one small project for learning." }]
  }));
' | curl --fail-with-body --silent --show-error \\
  https://api.cerebras.ai/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer \${CEREBRAS_API_KEY}" \\
  --data-binary @-`;
function resources(c, locale) {
  const d = copy[locale];
  return `${heading(d, d.resourceTitle, d.resourceIntro)}<div class="reading-layout"><article class="resource-steps"><section><h2>${e(d.step1)}</h2><p>${e(d.setup)}</p>${code(keySetup)}<p class="callout">${e(d.keyWarning)}</p></section><section><h2>${e(d.step2)}</h2><p>${e(d.modelHelp)}</p>${code(modelSetup)}</section><section><h2>${e(d.step3)}</h2><p>${e(d.requestHelp)}</p>${code(firstRequest)}<p class="callout">${e(d.docsChecked)}</p><p>${e(d.cleanup)}</p>${code('unset CEREBRAS_API_KEY MODEL_ID')}</section><section><h2>${e(d.errors)}</h2><ul><li>${e(d.error401)}</li><li>${e(d.error404)}</li><li>${e(d.error429)}</li></ul></section></article><aside class="resource-aside"><h2>${e(d.docs)}</h2><ul class="resource-links">${c.resources.map(link => `<li>${anchor(link.url, link.label[locale])}</li>`).join('')}</ul><p>${e(d.noBenefits)}</p></aside></div>`;
}
function slides(c, locale) {
  const d = copy[locale];
  return `<header class="deck-heading"><h1>${e(d.deckTitle)}</h1><p id="deck-help">${e(d.deckHelp)}</p></header><section class="deck" data-deck data-slide-label="${e(d.slide)}" data-of-label="${e(d.of)}" data-fullscreen-enter="${e(d.fullscreen)}" data-fullscreen-exit="${e(d.fullscreenExit)}" data-fullscreen-error="${e(d.fullscreenUnavailable)}" aria-label="${e(d.slides)}" aria-describedby="deck-help"><div class="deck-controls" hidden><button type="button" data-slide-prev>${e(d.previous)}</button><p data-slide-status aria-live="polite" aria-atomic="true"></p><button type="button" data-slide-next>${e(d.next)}</button><button type="button" data-fullscreen>${e(d.fullscreen)}</button><button type="button" data-print>${e(d.print)}</button></div><p data-deck-message role="status"></p><div class="slide-stack">${c.slides.map((slide, i) => `<article class="slide" id="slide-${i + 1}" aria-labelledby="slide-title-${i + 1}"><div class="slide-content"><p class="eyebrow">CAFE COMPUTE KIT / ${String(i + 1).padStart(2, '0')}</p><h2 id="slide-title-${i + 1}" tabindex="-1">${e(slide.title[locale])}</h2><p class="slide-body">${e(slide.body[locale])}</p><p class="slide-footer">${e(c.location[locale])} · ${e(d[c.status])}</p></div><details class="speaker-notes"><summary>${e(d.notes)}</summary><p>${e(slide.notes[locale])}</p></details></article>`).join('')}</div></section>`;
}
function recap(c, locale) {
  const d = copy[locale];
  const listSection = (title, items) => items.length ? `<section class="section"><h2>${e(title)}</h2><ul>${items.map(item => `<li>${e(item[locale])}</li>`).join('')}</ul></section>` : '';
  return `${heading(d, d.recapTitle, d.recapIntro)}<section class="journal"><h2 class="sr-only">${e(d.recap)}</h2>${c.recap.summary ? `<p class="lede">${e(c.recap.summary[locale])}</p>` : `<div class="empty-state"><span class="empty-mark" aria-hidden="true">—</span><p>${e(d.recapEmpty)}</p></div>`}${listSection(d.takeaways, c.recap.takeaways)}${listSection(d.nextSteps, c.recap.nextSteps)}<p class="editor-note">${e(d.recapPrompt)}</p>${anchor(route(locale, 'gallery'), d.gallery, 'button')}</section><details class="organizer-checklist"><summary>${e(d.organizerChecklist)}</summary><ol>${d.checklistItems.map(item => `<li>${e(item)}</li>`).join('')}</ol></details>`;
}
function gallery(c, locale) {
  const d = copy[locale];
  return `${heading(d, d.galleryTitle, d.galleryIntro)}${c.gallery.length ? `<div class="gallery-grid">${c.gallery.map(photo => `<figure><img src="${e(photo.imagePath)}" alt="${e(photo.alt[locale])}" loading="lazy" decoding="async"><figcaption><p>${e(photo.caption[locale])}</p><p class="small">${e(photo.credit[locale])} · ${anchor(photo.sourceUrl, d.source)}</p></figcaption></figure>`).join('')}</div>` : `<div class="empty-state gallery-empty"><span class="empty-frame" aria-hidden="true"></span><p>${e(d.galleryEmpty)}</p></div>`}<p class="editor-note">${e(d.galleryPrompt)}</p>`;
}
function privacy(c, locale) {
  const d = copy[locale];
  return `${heading(d, d.privacyTitle, c.privacy[locale])}<section class="section"><h2>${e(d.contact)}</h2><p>${c.contactUrl ? anchor(c.contactUrl, d.contact) : e(d.noContact)}</p>${c.feedbackUrl ? `<p>${e(d.feedbackSeparate)}</p>${anchor(c.feedbackUrl, d.feedback)}` : ''}</section>`;
}
export function renderSite(input) {
  const c = projectConfig(input);
  const pages = new Map();
  const templates = { '': home, resources, slides, recap, gallery, privacy };
  for (const locale of ['es', 'en']) for (const [part, render] of Object.entries(templates)) {
    const title = part ? copy[locale][part] : c.title[locale];
    pages.set(`${route(locale, part)}index.html`, shell(c, locale, part, title, render(c, locale)));
  }
  pages.set('/404.html', shell(c, 'es', '', '404', `<section class="page-heading"><h1>404</h1><p>${e(copy.es.notFound)} / ${e(copy.en.notFound)}</p>${anchor('/', copy.es.back)} · ${anchor('/en/', copy.en.back)}</section>`));
  return pages;
}
