/**
 * Minimal 127.0.0.1-only verification HTTP API preparing the SHORT-02 Studio UI contract.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Guardrails:
 * - Strictly loopback 127.0.0.1 binding only.
 * - Never executes arbitrary user scripts or shell commands.
 * - Reports INPUT_BLOCKED honestly when original cartoon-short-kit files are absent.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContractValidationError,
  RENDER_CONTRACT,
  validateProjectSpec,
} from '../shared/contract.mjs';
import {
  checkOriginalEngineFiles,
  createRendererAdapter,
  EngineInputBlockedError,
} from '../../engine/adapters/renderer_adapter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(payload);
}

async function readJsonBody(req, maxBytes = 64 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new ContractValidationError('Request payload too large', 'PAYLOAD_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ContractValidationError('Invalid JSON request body', 'INVALID_JSON');
  }
}

export async function startApiServer({ port = 0, projectRoot = ROOT } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');

      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'skill-stick-animation-short01-api',
          host: '127.0.0.1',
          originalEngine: checkOriginalEngineFiles(projectRoot),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/contract') {
        sendJson(res, 200, {
          contract: RENDER_CONTRACT,
          originalEngine: checkOriginalEngineFiles(projectRoot),
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/render/frame') {
        const body = await readJsonBody(req);
        const project = validateProjectSpec(body);
        const frameIndex = Number.isInteger(body.frameIndex) ? body.frameIndex : 0;

        const adapter = createRendererAdapter(projectRoot);
        try {
          const meta = await adapter.initializeRenderer(project);
          const frame = await adapter.renderFrame(frameIndex, { format: 'png' });
          sendJson(res, 200, {
            ok: true,
            metadata: meta,
            frame: {
              frameIndex: frame.frameIndex,
              width: frame.width,
              height: frame.height,
              bytes: frame.bytes,
              sha256: frame.sha256,
              format: frame.format,
            },
          });
        } finally {
          await adapter.disposeRenderer();
        }
        return;
      }

      sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      if (err instanceof EngineInputBlockedError) {
        sendJson(res, 409, {
          status: 'INPUT_BLOCKED',
          code: err.code,
          error: err.message,
          missingFiles: err.missingFiles,
        });
        return;
      }
      if (err instanceof ContractValidationError) {
        sendJson(res, 400, {
          code: err.code,
          error: err.message,
        });
        return;
      }
      sendJson(res, 500, { error: err?.message || 'Internal Server Error' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const addr = server.address();
  return {
    host: '127.0.0.1',
    port: addr.port,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.SHORT_STUDIO_PORT || 0);
  const srv = await startApiServer({ port });
  console.log(JSON.stringify({ listening: srv.baseUrl, host: srv.host, port: srv.port }));
}
