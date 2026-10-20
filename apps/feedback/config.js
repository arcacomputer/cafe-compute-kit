// One event per deployment. Secrets and owner addresses never enter static assets.
export function getConfig(env = {}) {
  let url;
  try { url = new URL(env.PUBLIC_ORIGIN); } catch { throw Error('PUBLIC_ORIGIN is required'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.href !== url.origin + '/') throw Error('PUBLIC_ORIGIN must be an HTTPS origin without path, credentials, query or fragment');
  const owners = (env.OWNER_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (owners.some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) throw Error('Invalid OWNER_EMAILS');
  return { origin: url.origin, owners, event: env.EVENT_NAME || 'Cafe Compute', provider: env.PROVIDER_NAME || 'Sponsor', benefit: env.BENEFIT_DESCRIPTION || 'A private sponsor benefit, subject to provider terms', photos: env.PHOTOS_ENABLED === 'true' && env.PRIVATE_PHOTO_METADATA_ACK === 'true', privacyVersion: '1' };
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function creditValue(value, type, env, synthetic = false) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\s\u0000-\u001f\u007f]/u.test(value)) return false;
  if (type === 'code') return /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/.test(value);
  if (type !== 'link') return false;
  try {
    const url = new URL(value);
    const origins = synthetic ? ['https://credits.example.invalid'] : (env.CREDIT_LINK_ORIGINS || '').split(',').filter(Boolean);
    return url.protocol === 'https:' && !url.username && !url.password && origins.includes(url.origin) && value.startsWith(url.origin + '/');
  } catch { return false; }
}
