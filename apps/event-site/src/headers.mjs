export const securityHeaders = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), fullscreen=(self)',
});
// Scope the static policy to event-owned paths. Do not constrain the separate feedback app.
export function headersFile() {
  const paths = ['/', '/index.html', '/en', '/en/', '/en/index.html', '/404', '/404.html', '/assets/*', '/media/*'];
  for (const prefix of ['', '/en']) for (const part of ['resources', 'slides', 'recap', 'gallery', 'privacy']) paths.push(`${prefix}/${part}`, `${prefix}/${part}/*`);
  return paths.map(path => `${path}\n${Object.entries(securityHeaders).map(([key, value]) => `  ${key}: ${value}`).join('\n')}`).join('\n\n') + '\n';
}
