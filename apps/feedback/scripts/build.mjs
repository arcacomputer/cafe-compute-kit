import { mkdir, rm, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { staticPages } from './static-pages.mjs';
const root = new URL('../', import.meta.url), dist = new URL('dist/', root);
// Explicit public projection. Owner addresses, tokens and database settings never serialize.
const pages = staticPages({ PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || 'https://feedback.example.invalid', EVENT_NAME: process.env.EVENT_NAME || 'Cafe Compute — example event', BENEFIT_DESCRIPTION: process.env.BENEFIT_DESCRIPTION });
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL('public/feedback/', root), new URL('feedback/', dist), { recursive: true });
for (const [name, html] of Object.entries(pages)) {
 const target = new URL(name, dist);
 await mkdir(new URL('./', target), { recursive: true });
 await writeFile(target, html);
}
console.log(`Built ${Object.keys(pages).length} public access pages in ${fileURLToPath(dist)}; private forms are Worker-rendered.`);
