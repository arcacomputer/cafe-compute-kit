import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DIST } from './build.mjs';
import { securityHeaders } from '../src/headers.mjs';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };
export function parsePreviewArgs(args) {
  if (!args.length) return { port: 4173 };
  if (args.length !== 2 || args[0] !== '--port') throw new TypeError('Usage: node scripts/preview.mjs [--port 4173] (localhost only)');
  if (!/^\d+$/.test(args[1]) || Number(args[1]) < 1 || Number(args[1]) > 65535) throw new TypeError('port must be 1–65535');
  return { port: Number(args[1]) };
}
export function createPreviewServer({ directory = DIST } = {}) {
  return createServer(async (req, res) => {
    const send = (status, body, type = 'text/plain; charset=utf-8', extra = {}) => {
      res.writeHead(status, { ...securityHeaders, 'Cache-Control': 'no-store', 'Content-Type': type, ...extra });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(req.method)) { send(405, 'Method not allowed', undefined, { Allow: 'GET, HEAD' }); return; }
    try {
      const raw = req.url.split('?')[0];
      const path = decodeURIComponent(raw);
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('\0') || path.split('/').some(segment => segment === '..' || segment === '.' || segment.startsWith('_') || segment.startsWith('.'))) throw new Error('not-found');
      const root = await realpath(directory);
      let target = join(root, path);
      if ((await stat(target)).isDirectory()) {
        if (!path.endsWith('/')) { send(308, '', undefined, { Location: `${path}/` }); return; }
        target = join(target, 'index.html');
      }
      target = await realpath(target);
      if (!target.startsWith(root + sep) || !mime[extname(target)]) throw new Error('not-found');
      const body = await readFile(target);
      send(200, body, mime[extname(target)]);
    } catch {
      try { send(404, await readFile(join(directory, '404.html')), mime['.html']); }
      catch { send(404, 'Not found. Build the event site first.'); }
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { port } = parsePreviewArgs(process.argv.slice(2));
    await stat(join(DIST, 'index.html'));
    const server = createPreviewServer();
    server.on('error', error => { console.error(`Preview failed: ${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`event-site preview: http://127.0.0.1:${port} (Ctrl+C to stop)`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  } catch (error) { console.error(`Preview failed: ${error.message}. Run the build first.`); process.exitCode = 1; }
}
