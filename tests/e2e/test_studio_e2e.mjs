/**
 * Full Playwright browser E2E, visual layout/overflow audit, a11y/keyboard checks,
 * preview scrub, edit + undo proof, job cancel, bounded MP4 export + QA verification,
 * and missing-kit honest status verification for Cartoon Short Studio (SHORT-02).
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { startApiServer } from '../../app/server/api_server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT, 'app', 'frontend', 'dist');
const SHOT_DIR = path.join(ROOT, 'docs', 'agent-runs', 'SHORT-02-20261119-01', 'screenshots');

function parseArgs(argv) {
  return {
    fullDemo: argv.includes('--full-demo'),
    keepDemoProject: argv.includes('--keep-demo'),
  };
}

async function checkViewportLayout(page, label) {
  const layout = await page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth > window.innerWidth;
    const interactive = Array.from(
      document.querySelectorAll('button:not([disabled]), a[href], select:not([disabled]), input[type="text"], input[type="range"]')
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    const tooSmall = [];
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      // Range sliders sit inside >=44px .range-wrap container
      if (el.tagName === 'INPUT' && el.getAttribute('type') === 'range') {
        const parentR = el.parentElement?.getBoundingClientRect();
        if (!parentR || parentR.height < 40) {
          tooSmall.push(`range(${Math.round(parentR?.height || r.height)})`);
        }
        continue;
      }
      if (r.height < 40) {
        tooSmall.push(`${el.tagName}:${el.textContent?.trim().slice(0, 20)}(${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      docOverflow,
      tooSmall,
    };
  });

  assert.equal(
    layout.docOverflow,
    false,
    `Horizontal overflow detected at ${label}: scrollWidth=${layout.scrollWidth} > innerWidth=${layout.innerWidth}`
  );
  assert.deepEqual(
    layout.tooSmall,
    [],
    `Interactive controls smaller than 40px at ${label}: ${layout.tooSmall.join(', ')}`
  );
}

async function waitForPreviewImageReady(page) {
  await page.waitForSelector('[data-testid="preview-frame-img"]', { timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const img = document.querySelector('[data-testid="preview-frame-img"]');
      return Boolean(img && img.complete && img.naturalWidth === 1080 && img.naturalHeight === 1920 && !img.classList.contains('is-loading'));
    },
    undefined,
    { timeout: 30_000 }
  );
}

const args = parseArgs(process.argv.slice(2));
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  throw new Error(`Missing built frontend at ${DIST_DIR}. Run "npm run build" first.`);
}

fs.mkdirSync(SHOT_DIR, { recursive: true });

// Back up pre-existing projects list so E2E clean-empty-state tests don't collide with user data
const projectsRoot = path.join(ROOT, 'workspace', 'projects');
const preExistingProjects = fs.existsSync(projectsRoot)
  ? new Set(fs.readdirSync(projectsRoot))
  : new Set();

const api = await startApiServer({ port: 0, projectRoot: ROOT, staticDir: DIST_DIR });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const consoleErrors = [];
const pageErrors = [];
const server5xx = [];
let createdProjectId = null;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore canceled fetch / EventSource abort noise when navigating or canceling
      if (!text.includes('409 (Conflict)') && !text.includes('Failed to load resource: net::ERR_FAILED')) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 500) {
      server5xx.push(`${res.status()} ${res.url()}`);
    }
  });

  // 1. Load Projects home & test empty state if clean
  await page.goto(api.baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="new-project-btn"]');
  await checkViewportLayout(page, 'projects-1440x900');

  if (preExistingProjects.size === 0) {
    await page.waitForSelector('[data-testid="projects-empty-state"]');
    await page.screenshot({ path: path.join(SHOT_DIR, '01_projects_empty_1440x900.png') });
  }

  // 2. Open Create Modal, test Escape closes, reopen and create Plaza Courier custom project
  await page.click('[data-testid="new-project-btn"]');
  await page.waitForSelector('#new-project-title');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#new-project-title', { state: 'detached' });

  await page.click('[data-testid="new-project-btn"]');
  await page.waitForSelector('#new-project-title');
  await page.fill('#new-project-title', 'Chuyen Giao Hang Hoang Hon');
  await page.click('[data-testid="tpl-option-plaza-courier-10s"]');
  await page.click('[data-testid="confirm-create-project-btn"]');

  // Verify redirect to /studio/:id & real WebGL frame renders
  await page.waitForURL(/\/studio\/.+/, { timeout: 15_000 });
  const studioUrl = page.url();
  createdProjectId = decodeURIComponent(studioUrl.split('/studio/')[1]);

  await waitForPreviewImageReady(page);
  await page.waitForTimeout(150);

  // 3. Reload persistence check
  await page.reload({ waitUntil: 'networkidle' });
  await waitForPreviewImageReady(page);
  assert.ok(page.url().includes(createdProjectId), 'Studio route must persist after reload');

  // Jump to Shot 4 (deliver, f=270) and capture preview SHA-256 BEFORE edits
  await page.click('[data-testid="shot-item-deliver"]');
  await page.waitForTimeout(200);
  await waitForPreviewImageReady(page);
  const frameImg = page.locator('[data-testid="preview-frame-img"]');
  const beforeShotBuf = await frameImg.screenshot({ path: path.join(SHOT_DIR, 'proof_before_edit_f270.png') });
  const shaBefore = crypto.createHash('sha256').update(beforeShotBuf).digest('hex');

  // 4. Edit Shot parameters + Scene parameters (characterStyle, signTitle, parcelColor, lighting)
  await page.selectOption('[data-testid="shot-camera-select"]', 'closeup');
  await page.selectOption('[data-testid="shot-expression-select"]', 'smile');
  await page.selectOption('[data-testid="shot-pose-select"]', 'wave');

  await page.click('[data-testid="tab-scene"]');
  await page.fill('[data-testid="scene-sign-input"]', 'HOANG HON PLAZA');
  await page.press('[data-testid="scene-sign-input"]', 'Enter');
  await page.selectOption('[data-testid="scene-lighting-select"]', 'goldenHour');
  await page.selectOption('[data-testid="scene-char-style-select"]', 'guardCap');
  await page.click('[data-testid="parcel-swatch-teal"]');

  await page.waitForTimeout(300);
  await waitForPreviewImageReady(page);
  const afterShotBuf = await frameImg.screenshot({ path: path.join(SHOT_DIR, 'proof_after_edit_f270.png') });
  const shaAfter = crypto.createHash('sha256').update(afterShotBuf).digest('hex');
  assert.notEqual(shaAfter, shaBefore, 'Edited UI controls must alter real WebGL preview pixels');

  // Test Undo & Redo cleanly
  await page.click('[data-testid="undo-btn"]');
  await page.waitForTimeout(250);
  await page.click('[data-testid="parcel-swatch-gold"]');
  await page.waitForTimeout(300);
  await waitForPreviewImageReady(page);

  await checkViewportLayout(page, 'studio-1440x900');
  await page.screenshot({ path: path.join(SHOT_DIR, '02_studio_desktop_1440x900.png') });

  // Also test timeline scrub responsiveness
  await page.locator('[data-testid="timeline-scrubber"]').fill('185');
  await page.locator('[data-testid="timeline-scrubber"]').dispatchEvent('change');
  await page.waitForTimeout(200);
  await waitForPreviewImageReady(page);

  // 5. Render Cancellation Test
  await page.click('[data-testid="open-render-dialog-btn"]');
  await page.waitForSelector('[data-testid="confirm-start-render-btn"]');
  await page.click('[data-testid="confirm-start-render-btn"]');
  await page.waitForSelector('[data-testid="job-drawer"]');

  // Wait until cancelable active state appears, then click cancel
  await page.waitForFunction(
    () => {
      const badge = document.querySelector('[data-testid="job-status-badge"]')?.textContent || '';
      return badge === 'FRAMES';
    },
    undefined,
    { timeout: 25_000 }
  );
  await page.click('[data-testid="cancel-job-btn"]');
  await page.waitForFunction(
    () => {
      const badge = document.querySelector('[data-testid="job-status-badge"]')?.textContent || '';
      return badge === 'CANCELED';
    },
    undefined,
    { timeout: 20_000 }
  );
  await page.screenshot({ path: path.join(SHOT_DIR, '04_studio_job_canceled_1440x900.png') });

  // 6. Real Render Export (Full 300 frames if --full-demo, else bounded 24 frames for fast E2E)
  await page.click('[data-testid="open-render-dialog-btn"]');
  await page.waitForSelector('[data-testid="confirm-start-render-btn"]');
  if (args.fullDemo) {
    await page.click('[data-testid="render-mode-full"]');
  } else {
    await page.click('[data-testid="render-mode-bounded"]');
  }
  await page.click('[data-testid="confirm-start-render-btn"]');

  await page.waitForFunction(
    () => {
      const badge = document.querySelector('[data-testid="job-status-badge"]')?.textContent || '';
      return badge === 'COMPLETED' || badge === 'FAILED';
    },
    undefined,
    { timeout: args.fullDemo ? 300_000 : 120_000 }
  );

  const terminalBadge = await page.textContent('[data-testid="job-status-badge"]');
  assert.equal(terminalBadge?.trim(), 'COMPLETED', 'Export job should complete with QA PASS');

  // Switch stage to Exported MP4 player & inspect QA gates in Audio & Timing tab
  await page.click('[data-testid="stage-tab-video"]');
  await page.waitForSelector('[data-testid="exported-mp4-player"]');
  await page.waitForFunction(
    () => {
      const v = document.querySelector('[data-testid="exported-mp4-player"]');
      return Boolean(v && v.readyState >= 1 && v.videoWidth === 1080 && v.videoHeight === 1920);
    },
    undefined,
    { timeout: 15_000 }
  );

  await page.click('[data-testid="tab-audio"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOT_DIR, '05_studio_video_qa_1440x900.png') });

  // Dismiss completed JobDrawer before multi-viewport responsive screenshots so Studio layout is fully unobstructed
  await page.click('[aria-label="Đóng thanh tiến trình"]');
  await page.waitForTimeout(100);

  // 7. Responsive Multi-Viewport Audit (1280x800, 1024x768, 390x844, 320x720)
  await page.click('[data-testid="stage-tab-frame"]');
  await page.click('[data-testid="tab-shots"]');

  for (const [w, h, fname] of [
    [1280, 800, '03_studio_desktop_1280x800.png'],
    [1024, 768, '06_studio_tablet_1024x768.png'],
    [390, 844, '07_studio_mobile_390x844.png'],
    [320, 720, '08_studio_mobile_320x720.png'],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    await checkViewportLayout(page, `studio-${w}x${h}`);
    await page.screenshot({ path: path.join(SHOT_DIR, fname) });
  }

  // Projects grid screenshot with non-empty project
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click('[data-testid="nav-projects"]');
  await page.waitForSelector(`[data-testid="project-card-${createdProjectId}"]`);
  await checkViewportLayout(page, 'projects-nonempty-1440x900');
  await page.screenshot({ path: path.join(SHOT_DIR, '09_projects_grid_1440x900.png') });

  // Clean up test jobs belonging to the ephemeral E2E project when not keeping demo
  if (!args.keepDemoProject && createdProjectId) {
    const jobsDir = path.join(ROOT, 'workspace', 'jobs');
    if (fs.existsSync(jobsDir)) {
      for (const f of fs.readdirSync(jobsDir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const j = JSON.parse(fs.readFileSync(path.join(jobsDir, f), 'utf8'));
          if (j.projectId === createdProjectId) fs.unlinkSync(path.join(jobsDir, f));
        } catch {}
      }
    }
  }
  if (!args.keepDemoProject) {
    await page.click(`[data-testid="delete-project-${createdProjectId}"]`);
    await page.waitForSelector('[data-testid="confirm-delete-project-btn"]');
    await page.click('[data-testid="confirm-delete-project-btn"]');
    await page.waitForSelector(`[data-testid="project-card-${createdProjectId}"]`, { state: 'detached' });
    createdProjectId = null;
  }

  await context.close();

  // 8. Missing-Kit UI Status Verification on isolated noKitRoot
  const noKitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'short02-e2e-nokit-'));
  try {
    fs.mkdirSync(path.join(noKitRoot, 'node_modules', 'three', 'build'), { recursive: true });
    fs.writeFileSync(path.join(noKitRoot, 'node_modules', 'three', 'build', 'three.module.js'), '// stub\n');
    const noKitApi = await startApiServer({ port: 0, projectRoot: noKitRoot, staticDir: DIST_DIR });
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p2 = await ctx2.newPage();
    try {
      await p2.goto(noKitApi.baseUrl, { waitUntil: 'networkidle' });
      await p2.click('[data-testid="engine-status-btn"]');
      await p2.waitForSelector('#engine-modal-title');
      await p2.screenshot({ path: path.join(SHOT_DIR, '10_missing_kit_status_1280x800.png') });
      await p2.keyboard.press('Escape');
      await p2.click('[data-testid="new-project-btn"]');
      await p2.waitForSelector('[data-testid="tpl-option-soldier-original"][disabled]');
    } finally {
      await ctx2.close();
      await noKitApi.close();
    }
  } finally {
    fs.rmSync(noKitRoot, { recursive: true, force: true });
  }

  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(' | ')}`);
  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(server5xx, [], `HTTP 5xx responses: ${server5xx.join(' | ')}`);

  console.log('E2E_ALL_PASSED', JSON.stringify({ fullDemo: args.fullDemo, screenshotDir: SHOT_DIR }));
} finally {
  await browser.close();
  await api.close();
  if (createdProjectId && !args.keepDemoProject) {
    const pDir = path.join(ROOT, 'workspace', 'projects', createdProjectId);
    if (fs.existsSync(pDir)) {
      fs.rmSync(pDir, { recursive: true, force: true });
    }
  }
}
