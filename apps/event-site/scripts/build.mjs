import { readFile, mkdir, writeFile, rename, rm, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projectConfig } from '../src/config.mjs';
import { renderSite } from '../src/render.mjs';
import { headersFile } from '../src/headers.mjs';
export const APP = fileURLToPath(new URL('../', import.meta.url));
export const DIST = join(APP, 'dist');
export const DEFAULT_CONFIG = fileURLToPath(new URL('../../../config/event.example.json', import.meta.url));
const assetNames = ['site.css', 'slides.mjs', 'mark.svg', 'table-notes.svg'];
export function parseArgs(args) {
  if (args.length === 0) return { config: DEFAULT_CONFIG };
  if (args.length === 2 && args[0] === '--config' && args[1] && !args[1].startsWith('-')) return { config: args[1] };
  throw new TypeError('Usage: node scripts/build.mjs [--config path/to/public-event.json]');
}
export async function approvedMediaPath(rootPath, source) {
  if (!(await lstat(rootPath)).isDirectory() || !(await lstat(source)).isFile()) throw new TypeError('gallery media requires a regular directory and file, not symlinks');
  const root = await realpath(rootPath);
  const actual = await realpath(source);
  if (!actual.startsWith(root + sep)) throw new TypeError('gallery media is outside the local boundary');
  return actual;
}
export async function createOutputPlan(input) {
  const config = projectConfig(input);
  const output = renderSite(config);
  output.set('/_headers', headersFile());
  for (const name of assetNames) output.set(`/assets/${name}`, await readFile(join(APP, 'public/assets', name), 'utf8'));
  // Copy only referenced, consent-confirmed media. Never recursively copy arbitrary public/ files.
  for (const photo of config.gallery) {
    const source = join(APP, 'public', photo.imagePath);
    const actual = await approvedMediaPath(join(APP, 'public/media'), source);
    const bytes = await readFile(actual);
    if (bytes.length > 10 * 1024 * 1024) throw new TypeError(`gallery image exceeds 10 MiB: ${photo.imagePath}`);
    output.set(photo.imagePath, bytes);
  }
  return output;
}
export async function build({ config: configPath = DEFAULT_CONFIG } = {}) {
  const input = JSON.parse(await readFile(resolve(configPath), 'utf8'));
  const output = await createOutputPlan(input);
  const staging = join(APP, `.dist-stage-${process.pid}`);
  await rm(staging, { recursive: true, force: true });
  try {
    for (const [path, content] of output) {
      const target = join(staging, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    await rm(DIST, { recursive: true, force: true });
    await rename(staging, DIST);
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { files: output.size, directory: DIST };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const result = await build(parseArgs(process.argv.slice(2))); console.log(`event-site: wrote ${result.files} files to ${result.directory}`); }
  catch (error) { console.error(`event-site build failed: ${error.message}`); process.exitCode = 1; }
}
