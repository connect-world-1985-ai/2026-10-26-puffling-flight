// Tiny static file server for local testing: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function startServer(port = 4173, host = '127.0.0.1') {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = resolve(ROOT, '.' + path);
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); res.end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok({ port: server.address().port, close: () => new Promise((r) => server.close(r)) }));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer(Number(process.argv[2] || 4173));
  console.log(`Serving ${ROOT} at http://127.0.0.1:${s.port}/ (Ctrl+C to stop)`);
}
