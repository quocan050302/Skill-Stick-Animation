/**
 * Loopback-only (127.0.0.1) static HTTP server with strict path-traversal protection.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

export function resolveSafeStaticPath(mounts, requestPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) {
    return null;
  }
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some((s) => s === '.' || s === '..')) {
    return null;
  }

  for (const mount of mounts) {
    const prefix = mount.prefix.replace(/\/+$/, '');
    const matched =
      prefix === '' || decoded === prefix || decoded.startsWith(`${prefix}/`);
    if (!matched) continue;

    const relRaw = prefix === '' ? decoded.slice(1) : decoded.slice(prefix.length + 1);
    const rootResolved = path.resolve(mount.dir);
    const target = path.resolve(rootResolved, relRaw || 'index.html');
    const relCheck = path.relative(rootResolved, target);
    if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
      return null;
    }
    return target;
  }
  return null;
}

export async function startLoopbackServer(mounts, port = 0) {
  const normalizedMounts = mounts.map((m) => ({
    prefix: m.prefix || '',
    dir: path.resolve(m.dir),
  }));

  const server = http.createServer((req, res) => {
    if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const rawPath = req.url.split('?')[0];
    if (/(^|\/)\.\.?(\/|$)|%2e%2e|\\|%5c|%00/i.test(rawPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    const parsed = new URL(req.url, 'http://127.0.0.1');
    const filePath = resolveSafeStaticPath(normalizedMounts, parsed.pathname);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    server,
    host: '127.0.0.1',
    port: addr.port,
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
