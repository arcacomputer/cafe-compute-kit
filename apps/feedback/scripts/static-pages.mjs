import { getConfig } from '../config.js';
import { loginView } from '../login-view.js';
// These pages disclose no session-derived content. Worker routes render private forms.
export function staticPages(env = {}) {
 const config = getConfig(env), pages = {};
 for (const es of [true, false]) {
  const base = es ? 'feedback/' : 'en/feedback/';
  for (const suffix of ['', 'sign-in/', 'credit/']) pages[`${base}${suffix}index.html`] = loginView(es, config);
 }
 return pages;
}
