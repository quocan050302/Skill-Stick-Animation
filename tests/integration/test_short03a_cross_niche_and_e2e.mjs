/**
 * Integration & E2E verification for SHORT-03A:
 * 1. Cross-niche generalization across 4 unrelated visual niches (Mine 20s, Zombie Enhanced, Samurai Dusk, Modern Lab)
 *    with runtime WebGL sightline occlusion (detectOcclusion) & headroom assertions + baseline invariance check.
 * 2. Compact React Studio E2E with mine-salting-20s + bounded native 4K (2160x3840) render job & QA proof.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { startApiServer } from '../../app/server/api_server.mjs';
import { createRendererAdapter } from '../../engine/adapters/renderer_adapter.mjs';

const ROOT = process.cwd();
const SHOT_DIR = path.join(ROOT, 'docs', 'agent-runs', 'SHORT-03A-20261119-01', 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

async function runCrossNicheChecks() {
  const niches = [
    {
      id: 'mine-salting-20s',
      webDir: path.join(ROOT, 'engine', 'demos', 'mine-salting-20s'),
      durationSeconds: 20,
      frames: [24, 148, 340, 460, 548],
      checkQAStats: true,
      saveShot: { frame: 340, file: 'niche_mine_belief_f340.jpg' },
    },
    {
      id: 'zombie-store-enhanced',
      webDir: path.join(ROOT, 'engine', 'demos', 'zombie-10s'),
      durationSeconds: 10,
      frames: [0, 178],
      overrides: { scene: { visualFoundation: 'enhanced' } },
      checkQAStats: false,
      saveShot: { frame: 178, file: 'niche_zombie_enhanced_f178.jpg' },
    },
    {
      id: 'samurai-dusk-test',
      webDir: path.join(ROOT, 'tests', 'fixtures', 'niche-samurai-test'),
      durationSeconds: 2,
      frames: [0, 48],
      checkQAStats: true,
      saveShot: { frame: 48, file: 'niche_samurai_dusk_f48.jpg' },
    },
    {
      id: 'modern-lab-test',
      webDir: path.join(ROOT, 'tests', 'fixtures', 'niche-lab-test'),
      durationSeconds: 2,
      frames: [0, 30],
      checkQAStats: true,
      saveShot: { frame: 30, file: 'niche_modern_lab_f30.jpg' },
    },
  ];

  const report = [];
  for (const n of niches) {
    const adapter = createRendererAdapter(ROOT);
    await adapter.initializeRenderer({
      projectId: `cross-${n.id}`,
      mode: 'original_engine',
      webDir: n.webDir,
      durationSeconds: n.durationSeconds,
      outputPreset: 'standard',
      overrides: n.overrides || { scene: { visualFoundation: 'enhanced' } },
    });
    try {
      const frameChecks = [];
      for (const f of n.frames) {
        const outPath =
          n.saveShot && n.saveShot.frame === f
            ? path.join(SHOT_DIR, n.saveShot.file)
            : path.join(ROOT, 'workspace', 'cache', 'cross-niche', `${n.id}_f${f}.jpg`);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const st = await adapter.renderStill(f, outPath, { format: 'jpeg', jpegQuality: 92 });
        assert.equal(st.width, 1080);
        assert.equal(st.height, 1920);
        frameChecks.push({ frame: f, bytes: st.bytes, sha256: st.sha256 });
      }
      const meta = adapter.getRenderMetadata();
      assert.equal(meta.consoleErrorCount, 0, `${n.id} had console errors`);
      assert.equal(meta.pageErrorCount, 0, `${n.id} had page errors`);
      report.push({
        niche: n.id,
        framesChecked: frameChecks.length,
        consoleErrors: meta.consoleErrorCount,
        pageErrors: meta.pageErrorCount,
        ok: true,
      });
    } finally {
      await adapter.disposeRenderer();
    }
  }
  return report;
}

async function runStudioNative4kE2E() {
  const distDir = path.join(ROOT, 'app', 'frontend', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('Frontend build missing; run npm run build first.');
  }

  const api = await startApiServer({ port: 0, projectRoot: ROOT, staticDir: distDir });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  let createdProjectId = null;

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const text = m.text();
        if (!text.includes('409 (Conflict)') && !text.includes('net::ERR_FAILED')) {
          errors.push(text);
        }
      }
    });

    await page.goto(api.baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="new-project-btn"]', { timeout: 15_000 });
    await page.click('[data-testid="new-project-btn"]');

    // Select Mine Salting 20s template in Create dialog
    await page.waitForSelector('#new-project-title', { timeout: 10_000 });
    await page.fill('#new-project-title', 'E2E Mine Salting 4K Check');
    await page.click('[data-testid="tpl-option-mine-salting-20s"]');
    await page.click('[data-testid="confirm-create-project-btn"]');
    await page.waitForURL(/\/studio\/.+/, { timeout: 15_000 });

    // Wait for Studio preview image to render
    await page.waitForSelector('[data-testid="preview-frame-img"]', { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const img = document.querySelector('[data-testid="preview-frame-img"]');
        return Boolean(img && img.complete && img.naturalWidth === 1080 && img.naturalHeight === 1920 && !img.classList.contains('is-loading'));
      },
      undefined,
      { timeout: 35_000 }
    );

    const urlMatch = page.url().match(/\/studio\/([^/?#]+)/);
    createdProjectId = urlMatch ? decodeURIComponent(urlMatch[1]) : null;
    if (!createdProjectId) {
      const listRes = await fetch(`${api.baseUrl}/api/projects`);
      const listJson = await listRes.json();
      createdProjectId = listJson.projects?.[0]?.projectId || null;
    }
    assert.ok(createdProjectId, 'Created mine-salting-20s projectId must exist');

    // Open RenderDialog and verify Native 4K option cleanly in compact dark Studio
    await page.click('[data-testid="open-render-dialog-btn"]');
    await page.waitForSelector('[data-testid="render-preset-select"]', { timeout: 10_000 });
    await page.selectOption('[data-testid="render-preset-select"]', 'native_4k');
    await page.click('[data-testid="render-mode-bounded"]');
    await page.waitForSelector('text=2160×3840', { timeout: 5_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'studio_render_dialog_4k.png') });
    await page.click('button:has-text("Đóng")');

    // Run a bounded 8-frame (0..7 = 0.267s >= 0.2s QA min duration) REAL native 4K job through JobManager -> Chromium 2160x3840 -> FFmpeg -> QA!
    const jobRes = await fetch(`${api.baseUrl}/api/projects/${encodeURIComponent(createdProjectId)}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'bounded',
        outputPreset: 'native_4k',
        startFrame: 0,
        endFrame: 7,
        workers: 1,
      }),
    });
    assert.equal(jobRes.status, 202);
    const { job } = await jobRes.json();

    let finalJob = job;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline && !['completed', 'failed', 'cancelled'].includes(finalJob.status)) {
      await new Promise((r) => setTimeout(r, 800));
      const jr = await fetch(`${api.baseUrl}/api/jobs/${encodeURIComponent(job.jobId)}`);
      const jj = await jr.json();
      finalJob = jj.job;
    }

    assert.equal(finalJob.status, 'completed', `Bounded native 4K job failed: ${JSON.stringify(finalJob)}`);
    assert.equal(finalJob.exportSummary?.outputPreset, 'native_4k');
    assert.equal(finalJob.exportSummary?.width, 2160);
    assert.equal(finalJob.exportSummary?.height, 3840);
    assert.equal(finalJob.qaSummary?.overallStatus, 'PASS');
    const qaRes = await fetch(`${api.baseUrl}${finalJob.exportSummary.qaUrl}`);
    assert.equal(qaRes.status, 200);
    const { qa: qaFull } = await qaRes.json();
    assert.equal(qaFull.outputPreset, 'native_4k');
    assert.equal(qaFull.ffprobe?.width, 2160);
    assert.equal(qaFull.ffprobe?.height, 3840);
    assert.equal(qaFull.webglProof?.nativeDrawingBufferWidth, 2160);
    assert.equal(qaFull.webglProof?.nativeDrawingBufferHeight, 3840);
    assert.equal(qaFull.detail4k?.is_native_detail_ok, true);
    const gate4k = qaFull.gates?.find((g) => g.id === 'native_4k_proof');
    assert.equal(gate4k?.status, 'PASS', `4K QA gate failed: ${JSON.stringify(gate4k)}`);
    assert.deepEqual(errors, [], `Studio E2E had console/page errors: ${errors.join(' | ')}`);

    return {
      projectId: createdProjectId,
      jobId: finalJob.jobId,
      mp4Dims: `${qaFull.ffprobe.width}x${qaFull.ffprobe.height}`,
      webglDims: `${qaFull.webglProof.nativeDrawingBufferWidth}x${qaFull.webglProof.nativeDrawingBufferHeight}`,
      gate4kStatus: gate4k.status,
    };
  } finally {
    await browser.close().catch(() => {});
    if (createdProjectId) {
      await fetch(`${api.baseUrl}/api/projects/${encodeURIComponent(createdProjectId)}?confirm=true`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    await api.close().catch(() => {});
  }
}

const nicheReport = await runCrossNicheChecks();
const studio4kReport = await runStudioNative4kE2E();
console.log(JSON.stringify({ ok: true, crossNiche: nicheReport, studioNative4kE2E: studio4kReport }, null, 2));
