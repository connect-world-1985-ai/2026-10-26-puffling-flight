// Local stand-in for GitHub Pages while the host is unavailable: static files from the repo root, correct MIME
// types, HTTP Range (206) for video seeking, 404 for anything missing. Binds 127.0.0.1 only.
// Run: node verify/static-server.mjs <port>     (prints its PID so it can be stopped by PID)
import { createServer } from 'node:http';
import { stat, open } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon' };
const port = Number(process.argv[2] || 8765);
createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(ROOT, '.' + path);
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); res.end(); return; }
    const st = await stat(file); if (!st.isFile()) throw new Error('not a file');
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    let start = 0, end = st.size - 1, code = 200;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m) {
      if (m[1] === '') { start = Math.max(0, st.size - Number(m[2])); } else { start = Number(m[1]); if (m[2] !== '') end = Math.min(end, Number(m[2])); }
      if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
      code = 206;
    }
    const h = { 'Content-Type': type, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    if (code === 206) h['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
    res.writeHead(code, h);
    if (req.method === 'HEAD') { res.end(); return; }
    const fh = await open(file); const s = fh.createReadStream({ start, end });
    s.on('close', () => fh.close().catch(() => {})); s.on('error', () => res.destroy()); res.on('close', () => s.destroy());
    s.pipe(res);
  } catch (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`SERVING pid=${process.pid} http://127.0.0.1:${port}/ root=${ROOT}`));
