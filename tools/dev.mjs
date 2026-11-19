/**
 * Unified FE + BE runner for Cartoon Short Studio (SHORT-02).
 *
 * Usage:
 *   node tools/dev.mjs --mode dev     -> starts local API server + Vite dev server with /api proxy
 *   node tools/dev.mjs --mode start   -> serves built app/frontend/dist + API on one loopback origin
 */

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startApiServer } from '../app/server/api_server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function parseArgs(argv) {
  const out = { mode: 'dev' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--mode' && argv[i + 1]) {
      out.mode = argv[++i];
    }
  }
  return out;
}

function killTree(child) {
  if (!child || !child.pid) return Promise.resolve();
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve());
    });
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  return Promise.resolve();
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return true;
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'start') {
  const distDir = path.join(ROOT, 'app', 'frontend', 'dist');
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.error(`Chưa có bản build giao diện tại ${indexHtml}. Hãy chạy "npm run build" trước.`);
    process.exit(1);
  }
  const port = Number(process.env.PORT || 5173);
  const api = await startApiServer({
    port,
    projectRoot: ROOT,
    staticDir: distDir,
  });
  console.log('');
  console.log('=== Cartoon Short Studio (Production / Built) ===');
  console.log(`Studio UI & API : ${api.baseUrl}/`);
  console.log(`API Health      : ${api.baseUrl}/api/health`);
  console.log('Nhấn Ctrl+C để dừng máy chủ an toàn.');
  console.log('');

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('\nĐang dừng Studio...');
    await api.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else {
  const apiPort = Number(process.env.API_PORT || 8787);
  const vitePort = Number(process.env.VITE_PORT || process.env.PORT || 5173);

  const api = await startApiServer({
    port: apiPort,
    projectRoot: ROOT,
  });

  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const viteChild = spawn(
    process.execPath,
    [
      viteBin,
      '--config',
      path.join(ROOT, 'app', 'frontend', 'vite.config.ts'),
      '--host',
      '127.0.0.1',
      '--port',
      String(vitePort),
      '--strictPort',
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        VITE_API_PORT: String(api.port),
      },
      stdio: 'inherit',
      windowsHide: true,
      detached: process.platform !== 'win32',
    }
  );

  let shuttingDown = false;
  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\nĐang dừng Vite & API Server (và phiên Chromium nếu có)...');
    await killTree(viteChild);
    await api.close();
    process.exit(exitCode);
  };

  viteChild.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`Vite thoát bất ngờ với mã ${code}. Đang dọn API Server...`);
      void shutdown(code || 1);
    }
  });

  process.on('SIGINT', () => void shutdown(0));
  process.on('SIGTERM', () => void shutdown(0));

  const feUrl = `http://127.0.0.1:${vitePort}/`;
  const ready = await waitForHttp(feUrl, 25_000);
  if (!ready) {
    console.error(`Vite không sẵn sàng tại ${feUrl} sau 25 giây.`);
    await shutdown(1);
  }

  console.log('');
  console.log('=== Cartoon Short Studio (Dev FE + BE) ===');
  console.log(`Studio UI  : ${feUrl}`);
  console.log(`Backend API: ${api.baseUrl}/api/health`);
  console.log('Nhấn Ctrl+C để tắt cả FE và BE.');
  console.log('');
}
