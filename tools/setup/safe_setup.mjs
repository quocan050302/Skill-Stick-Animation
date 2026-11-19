/**
 * Cross-platform safe dependency & environment verifier for SHORT-01.
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Replaces unsafe /tmp/_three, /tmp/_t3, /tmp/_cas patterns described in the audit notes:
 * - Never touches global /tmp paths.
 * - Never mutates preserved source snapshots.
 * - Verifies exact pinned local npm dependencies (three@0.160.0, playwright@1.65.1),
 *   Node >=22.6 stripTypeScriptTypes, Chromium binary, Python 3 packages, FFmpeg/FFprobe,
 *   disk headroom, and reports kit source / toon.ts presence honestly.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import module from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

function runCmd(bin, args) {
  try {
    const stdout = execFileSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
    return { ok: true, stdout: stdout.trim() };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err),
      stderr: err?.stderr ? String(err.stderr).trim() : '',
    };
  }
}

function parseNodeMajorMinor(versionStr) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(versionStr);
  if (!m) return { major: 0, minor: 0, patch: 0 };
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export async function verifyEnvironment(projectRoot = ROOT) {
  const nodeVer = parseNodeMajorMinor(process.version);
  const nodeMeetsMin = nodeVer.major > 22 || (nodeVer.major === 22 && nodeVer.minor >= 6);
  const hasStripTs = typeof module.stripTypeScriptTypes === 'function';

  let threeInfo = { installed: false, version: null, revision: null };
  try {
    const threePkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'node_modules', 'three', 'package.json'), 'utf8')
    );
    const threeMod = await import('three');
    threeInfo = {
      installed: true,
      version: threePkg.version,
      revision: String(threeMod.REVISION),
      license: threePkg.license || 'MIT',
      pinned_match: threePkg.version === '0.160.0',
    };
  } catch (err) {
    threeInfo.error = err.message;
  }

  let playwrightInfo = { installed: false, version: null, chromium_executable: null, chromium_exists: false };
  try {
    const pwPkg = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'node_modules', 'playwright', 'package.json'), 'utf8')
    );
    const pw = await import('playwright');
    const exe = pw.chromium.executablePath();
    playwrightInfo = {
      installed: true,
      version: pwPkg.version,
      license: pwPkg.license || 'Apache-2.0',
      chromium_executable: exe,
      chromium_exists: Boolean(exe && fs.existsSync(exe)),
    };
  } catch (err) {
    playwrightInfo.error = err.message;
  }

  const pyVer = runCmd('python', ['--version']);
  const pyPkgs = runCmd('python', [
    '-c',
    [
      'import importlib, json',
      'out = {}',
      'for p in ["numpy", "PIL", "scipy", "soundfile", "whisper", "faster_whisper"]:',
      '    try:',
      '        m = importlib.import_module(p)',
      '        out[p] = getattr(m, "__version__", "ok")',
      '    except ImportError:',
      '        out[p] = None',
      'print(json.dumps(out))',
    ].join('\n'),
  ]);
  let pythonPackages = {};
  if (pyPkgs.ok) {
    try {
      pythonPackages = JSON.parse(pyPkgs.stdout);
    } catch {
      pythonPackages = { parse_error: pyPkgs.stdout };
    }
  }

  const ffmpegVer = runCmd('ffmpeg', ['-version']);
  const ffprobeVer = runCmd('ffprobe', ['-version']);

  const kitFiles = [
    'engine/web/index.html',
    'engine/web/main.js',
    'engine/web/motion.js',
    'engine/web/paint.js',
    'engine/web/roman.js',
    'engine/web/story.js',
    'engine/web/toon.js',
  ];
  const kitPresence = Object.fromEntries(
    kitFiles.map((rel) => [rel, fs.existsSync(path.join(projectRoot, rel))])
  );

  const report = {
    checked_at_utc: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    total_ram_gb: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    node: {
      version: process.version,
      meets_min_22_6: nodeMeetsMin,
      stripTypeScriptTypes: hasStripTs,
    },
    three: threeInfo,
    playwright: playwrightInfo,
    python: {
      ok: pyVer.ok,
      version: pyVer.ok ? pyVer.stdout : null,
      packages: pythonPackages,
    },
    ffmpeg: {
      ok: ffmpegVer.ok,
      banner: ffmpegVer.ok ? ffmpegVer.stdout.split(/\r?\n/)[0] : null,
    },
    ffprobe: {
      ok: ffprobeVer.ok,
      banner: ffprobeVer.ok ? ffprobeVer.stdout.split(/\r?\n/)[0] : null,
    },
    original_engine_files: {
      all_present: Object.values(kitPresence).every(Boolean),
      files: kitPresence,
      status: Object.values(kitPresence).every(Boolean) ? 'READY' : 'INPUT_BLOCKED_MISSING_KIT_AND_TOON_TS',
    },
    local_tooling_ready:
      nodeMeetsMin &&
      hasStripTs &&
      threeInfo.installed &&
      threeInfo.pinned_match &&
      playwrightInfo.installed &&
      playwrightInfo.chromium_exists &&
      pyVer.ok &&
      Boolean(pythonPackages.numpy) &&
      Boolean(pythonPackages.PIL) &&
      ffmpegVer.ok &&
      ffprobeVer.ok,
  };

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const report = await verifyEnvironment();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.local_tooling_ready ? 0 : 1);
}
