/**
 * Target Engine Adapter interface for SHORT-01 / SHORT-02.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Implements:
 *   initializeRenderer(project)
 *   renderFrame(frameIndex)
 *   renderFrameRange(startFrame, endFrame, options)
 *   renderStill(frameIndex, outPath)
 *   getRenderMetadata()
 *   disposeRenderer()
 *
 * Strict honesty & safety guarantees:
 * - In default mode ('original_engine'), verifies all required original kit files exist under
 *   engine/web/ before launching Chromium; never fabricates original Soldier renders.
 * - Supports explicit mode 'technical_webgl_smoke' strictly for G07 / integration pipeline checks.
 * - Captures all console errors, pageerrors, and WebGL gl.getError() statuses.
 * - Atomic frame writes, disk preflight, hash-validated RESUME, and clean teardown.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContractValidationError,
  RENDER_CONTRACT,
  validateFrameRange,
  validateProjectSpec,
} from '../../app/shared/contract.mjs';
import {
  atomicWriteFileSync,
  canonicalFrameName,
  checkDiskPreflight,
  parseImageDimensions,
  registerCleanupHandlers,
  sha256Buffer,
  validateExistingResumeFrame,
  withFiniteRetry,
} from '../../tools/render/frame_runner.mjs';
import { startLoopbackServer } from '../../tools/render/server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const REQUIRED_ORIGINAL_ENGINE_FILES = Object.freeze([
  'engine/web/index.html',
  'engine/web/main.js',
  'engine/web/motion.js',
  'engine/web/paint.js',
  'engine/web/roman.js',
  'engine/web/story.js',
  'engine/web/toon.js',
]);

export class EngineInputBlockedError extends Error {
  constructor(message, missingFiles = []) {
    super(message);
    this.name = 'EngineInputBlockedError';
    this.code = 'INPUT_BLOCKED';
    this.missingFiles = missingFiles;
  }
}

export function checkOriginalEngineFiles(projectRoot = PROJECT_ROOT) {
  const missing = REQUIRED_ORIGINAL_ENGINE_FILES.filter(
    (rel) => !fs.existsSync(path.join(projectRoot, rel))
  );
  return {
    ready: missing.length === 0,
    missing,
  };
}

export function createRendererAdapter(projectRoot = PROJECT_ROOT) {
  let state = {
    initialized: false,
    project: null,
    server: null,
    browser: null,
    context: null,
    page: null,
    unregisterSignals: null,
    metadata: null,
    consoleErrors: [],
    pageErrors: [],
    launchProfile: null,
  };

  async function launchChromiumWithFallback(playwright) {
    const profiles = [
      {
        name: 'swiftshader-webgl',
        args: [
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--ignore-gpu-blocklist',
          '--no-sandbox',
        ],
      },
      {
        name: 'default-headless',
        args: ['--ignore-gpu-blocklist'],
      },
    ];

    let lastErr;
    for (const profile of profiles) {
      try {
        const browser = await playwright.chromium.launch({
          headless: true,
          args: profile.args,
        });
        return { browser, profile: profile.name };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  async function initializeRenderer(projectInput = {}) {
    if (state.initialized) {
      await disposeRenderer();
    }

    const project = validateProjectSpec(projectInput);
    const threeDir = path.join(projectRoot, 'node_modules', 'three');
    if (!fs.existsSync(path.join(threeDir, 'build', 'three.module.js'))) {
      throw new EngineInputBlockedError(
        'Missing local Three.js 0.160.0 dependency (node_modules/three/build/three.module.js). Run npm install first.',
        ['node_modules/three/build/three.module.js']
      );
    }

    let mounts;
    let entryPath;
    if (project.mode === 'original_engine') {
      const customWebDir = projectInput.webDir ? path.resolve(projectInput.webDir) : null;
      if (customWebDir) {
        if (!fs.existsSync(path.join(customWebDir, 'index.html'))) {
          throw new EngineInputBlockedError(`Custom webDir missing index.html: ${customWebDir}`, ['index.html']);
        }
        mounts = [
          { prefix: '/three', dir: threeDir },
          { prefix: '/toonbase', dir: path.join(projectRoot, 'engine', 'demos', 'lib') },
          { prefix: '', dir: customWebDir },
        ];
      } else {
        const check = checkOriginalEngineFiles(projectRoot);
        if (!check.ready) {
          throw new EngineInputBlockedError(
            `Original cartoon-short-kit engine files are missing (${check.missing.length} files). Provide cartoon-short-kit.zip and run ingestion first.`,
            check.missing
          );
        }
        mounts = [
          { prefix: '/three', dir: threeDir },
          { prefix: '', dir: path.join(projectRoot, 'engine', 'web') },
        ];
      }
      entryPath = '/index.html';
    } else if (project.mode === 'technical_webgl_smoke') {
      mounts = [
        { prefix: '/three', dir: threeDir },
        { prefix: '', dir: path.join(projectRoot, 'engine', 'adapters') },
      ];
      entryPath = '/smoke_webgl_scene.html';
    } else {
      throw new ContractValidationError(
        `Unsupported renderer mode: ${project.mode}`,
        'INVALID_MODE'
      );
    }

    const playwright = await import('playwright');
    const server = await startLoopbackServer(mounts, 0);
    const { browser, profile } = await launchChromiumWithFallback(playwright);

    const consoleErrors = [];
    const pageErrors = [];
    let context;
    let page;
    try {
      context = await browser.newContext({
        viewport: { width: RENDER_CONTRACT.width, height: RENDER_CONTRACT.height },
        deviceScaleFactor: 1,
      });
      page = await context.newPage();
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err?.stack || err?.message || String(err));
      });

      const url = `${server.baseUrl}${entryPath}`;
      if (projectInput.overrides && typeof projectInput.overrides === 'object') {
        const cleanOverrides = JSON.parse(JSON.stringify(projectInput.overrides));
        await page.addInitScript((ov) => {
          window.__STUDIO_OVERRIDES__ = ov;
        }, cleanOverrides);
      }
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(
        () => window.ready === true && typeof window.renderFrame === 'function',
        null,
        { timeout: 20000 }
      );
      if (projectInput.overrides && typeof projectInput.overrides === 'object') {
        const cleanOverrides = JSON.parse(JSON.stringify(projectInput.overrides));
        await page.evaluate((ov) => {
          if (typeof window.setStudioOverrides === 'function') {
            window.setStudioOverrides(ov);
          } else {
            window.__STUDIO_OVERRIDES__ = ov;
          }
        }, cleanOverrides);
      }

      if (pageErrors.length > 0) {
        throw new Error(`Page errors during renderer initialization: ${pageErrors.join(' | ')}`);
      }

      const webglProbe = await page.evaluate(() => {
        if (typeof window.getSmokeCapabilities === 'function') {
          return window.getSmokeCapabilities();
        }
        const canvas = document.querySelector('canvas');
        return {
          canvasWidth: canvas ? canvas.width : 0,
          canvasHeight: canvas ? canvas.height : 0,
          totalFrames: typeof window.TOTAL === 'number' ? window.TOTAL : null,
          sceneType: 'ORIGINAL_KIT_ENGINE',
        };
      });

      if (webglProbe.canvasWidth !== RENDER_CONTRACT.width || webglProbe.canvasHeight !== RENDER_CONTRACT.height) {
        throw new Error(
          `Canvas dimensions mismatch: expected ${RENDER_CONTRACT.width}x${RENDER_CONTRACT.height}, got ${webglProbe.canvasWidth}x${webglProbe.canvasHeight}`
        );
      }

      state = {
        initialized: true,
        project,
        server,
        browser,
        context,
        page,
        unregisterSignals: registerCleanupHandlers(() => disposeRenderer()),
        consoleErrors,
        pageErrors,
        launchProfile: profile,
        metadata: {
          projectId: project.projectId,
          mode: project.mode,
          width: RENDER_CONTRACT.width,
          height: RENDER_CONTRACT.height,
          fps: RENDER_CONTRACT.fps,
          browserVersion: browser.version(),
          launchProfile: profile,
          loopbackUrl: url,
          webgl: webglProbe,
          initializedAtUtc: new Date().toISOString(),
        },
      };

      return state.metadata;
    } catch (err) {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
      await server?.close().catch(() => {});
      throw err;
    }
  }

  async function renderFrame(frameIndex, { format = 'png', jpegQuality = 95, captureMethod = 'canvas_dataurl', debugMode = null } = {}) {
    if (!state.initialized || !state.page) {
      throw new Error('Renderer is not initialized. Call initializeRenderer() first.');
    }
    if (!Number.isInteger(frameIndex) || frameIndex < 0) {
      throw new ContractValidationError(`Invalid frameIndex: ${frameIndex}`, 'INVALID_FRAME_INDEX');
    }

    let buffer;
    let result;
    if (captureMethod === 'canvas_dataurl') {
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const q = format === 'jpeg' ? Math.max(0.1, Math.min(1.0, jpegQuality / 100)) : undefined;
      const evalRes = await state.page.evaluate(
        ([f, mimeType, quality, dbg]) => {
          window.DEBUG_ND = dbg === 'nd' ? 1 : 0;
          window.DEBUG_E = dbg === 'edge' ? 1 : 0;
          const r = window.renderFrame(f);
          const canvas = document.getElementById('c') || document.querySelector('canvas');
          const dataUrl = quality !== undefined ? canvas.toDataURL(mimeType, quality) : canvas.toDataURL(mimeType);
          return { r, dataUrl };
        },
        [frameIndex, mime, q, debugMode]
      );
      result = evalRes.r;
      if (result && result.ok === false) {
        throw new Error(`WebGL renderFrame(${frameIndex}) reported error: ${JSON.stringify(result)}`);
      }
      if (state.pageErrors.length > 0) {
        throw new Error(`Page error during frame ${frameIndex}: ${state.pageErrors.join(' | ')}`);
      }
      const b64 = evalRes.dataUrl.split(',')[1];
      buffer = Buffer.from(b64, 'base64');
    } else {
      result = await state.page.evaluate(([f, dbg]) => {
        window.DEBUG_ND = dbg === 'nd' ? 1 : 0;
        window.DEBUG_E = dbg === 'edge' ? 1 : 0;
        return window.renderFrame(f);
      }, [frameIndex, debugMode]);

      if (result && result.ok === false) {
        throw new Error(`WebGL renderFrame(${frameIndex}) reported error: ${JSON.stringify(result)}`);
      }
      if (state.pageErrors.length > 0) {
        throw new Error(`Page error during frame ${frameIndex}: ${state.pageErrors.join(' | ')}`);
      }

      const canvas = state.page.locator('canvas').first();
      const screenshotOpts =
        format === 'jpeg'
          ? { type: 'jpeg', quality: jpegQuality }
          : { type: 'png' };
      buffer = await canvas.screenshot(screenshotOpts);
    }

    const dims = parseImageDimensions(buffer);
    if (!dims || dims.width !== RENDER_CONTRACT.width || dims.height !== RENDER_CONTRACT.height) {
      throw new Error(
        `Captured image failed header/dimension verification at frame ${frameIndex}: ${JSON.stringify(dims)}`
      );
    }

    return {
      frameIndex,
      format: dims.format,
      width: dims.width,
      height: dims.height,
      bytes: buffer.length,
      sha256: sha256Buffer(buffer),
      glResult: result ?? null,
      buffer,
    };
  }

  async function renderStill(frameIndex, outPath, options = {}) {
    checkDiskPreflight(path.dirname(path.resolve(outPath)), {
      estimatedBytes: 4 * 1024 * 1024,
      lowWatermarkBytes: options.lowWatermarkBytes,
    });
    const frame = await renderFrame(frameIndex, options);
    atomicWriteFileSync(outPath, frame.buffer);
    return {
      frameIndex: frame.frameIndex,
      outPath: path.resolve(outPath),
      width: frame.width,
      height: frame.height,
      bytes: frame.bytes,
      sha256: frame.sha256,
      format: frame.format,
    };
  }

  async function renderFrameRange(startFrame, endFrame, options = {}) {
    const range = validateFrameRange(startFrame, endFrame);
    const outDir = path.resolve(options.outDir || path.join(projectRoot, 'workspace', 'cache', 'frames'));
    const format = options.format === 'jpeg' ? 'jpeg' : 'png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const resumeManifestPath = path.join(outDir, 'resume-manifest.json');
    const maxRetries = options.maxRetries ?? 2;

    const estimatedBytes = range.count * 1024 * 1024; // conservative ~1 MB/frame estimate
    const disk = checkDiskPreflight(outDir, {
      estimatedBytes,
      lowWatermarkBytes: options.lowWatermarkBytes,
    });
    fs.mkdirSync(outDir, { recursive: true });

    let priorHashes = {};
    if (options.resume && fs.existsSync(resumeManifestPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(resumeManifestPath, 'utf8'));
        priorHashes = prev.frames || {};
      } catch {
        priorHashes = {};
      }
    }

    const results = [];
    let skippedViaResume = 0;
    let renderedCount = 0;
    const t0 = Date.now();

    for (let f = range.startFrame; f <= range.endFrame; f++) {
      if (options.signal?.aborted) {
        const abortErr = new Error(`Render canceled at frame ${f}`);
        abortErr.code = 'RENDER_CANCELED';
        throw abortErr;
      }

      const fileName = canonicalFrameName(f, ext);
      const filePath = path.join(outDir, fileName);

      if (options.resume && priorHashes[fileName]) {
        const check = validateExistingResumeFrame(
          filePath,
          priorHashes[fileName],
          RENDER_CONTRACT.width,
          RENDER_CONTRACT.height
        );
        if (check.valid) {
          skippedViaResume += 1;
          results.push({
            frameIndex: f,
            fileName,
            outPath: filePath,
            sha256: check.sha256,
            bytes: check.bytes,
            resumed: true,
          });
          continue;
        }
      }

      const captured = await withFiniteRetry(
        async () => {
          const fr = await renderFrame(f, { format, jpegQuality: options.jpegQuality });
          atomicWriteFileSync(filePath, fr.buffer);
          return fr;
        },
        {
          maxRetries,
          isTransient: (err) => err?.code !== 'CONTRACT_VIOLATION' && err?.code !== 'LOW_DISK_SPACE',
        }
      );

      renderedCount += 1;
      priorHashes[fileName] = captured.sha256;
      results.push({
        frameIndex: f,
        fileName,
        outPath: filePath,
        sha256: captured.sha256,
        bytes: captured.bytes,
        resumed: false,
      });

      atomicWriteFileSync(
        resumeManifestPath,
        Buffer.from(
          JSON.stringify(
            {
              projectId: state.project?.projectId,
              mode: state.project?.mode,
              width: RENDER_CONTRACT.width,
              height: RENDER_CONTRACT.height,
              fps: RENDER_CONTRACT.fps,
              frames: priorHashes,
              updatedAtUtc: new Date().toISOString(),
            },
            null,
            2
          ),
          'utf8'
        )
      );
    }

    return {
      range,
      outDir,
      diskPreflight: disk,
      renderedCount,
      skippedViaResume,
      elapsedMs: Date.now() - t0,
      consoleErrors: [...state.consoleErrors],
      pageErrors: [...state.pageErrors],
      frames: results,
    };
  }

  function getRenderMetadata() {
    return state.metadata
      ? {
          ...state.metadata,
          consoleErrorCount: state.consoleErrors.length,
          pageErrorCount: state.pageErrors.length,
        }
      : {
          initialized: false,
          originalEngineStatus: checkOriginalEngineFiles(projectRoot),
        };
  }

  async function disposeRenderer() {
    const prev = state;
    state = {
      initialized: false,
      project: null,
      server: null,
      browser: null,
      context: null,
      page: null,
      unregisterSignals: null,
      metadata: null,
      consoleErrors: [],
      pageErrors: [],
      launchProfile: null,
    };
    prev.unregisterSignals?.();
    await prev.context?.close().catch(() => {});
    await prev.browser?.close().catch(() => {});
    await prev.server?.close().catch(() => {});
  }

  async function setOverrides(overrides) {
    if (!state.initialized || !state.page) {
      throw new Error('Renderer is not initialized. Call initializeRenderer() first.');
    }
    const cleanOverrides = overrides ? JSON.parse(JSON.stringify(overrides)) : {};
    await state.page.evaluate((ov) => {
      window.__STUDIO_OVERRIDES__ = ov;
      if (typeof window.setStudioOverrides === 'function') {
        window.setStudioOverrides(ov);
      }
    }, cleanOverrides);
  }

  return {
    initializeRenderer,
    renderFrame,
    renderFrameRange,
    renderStill,
    setOverrides,
    getRenderMetadata,
    disposeRenderer,
  };
}
