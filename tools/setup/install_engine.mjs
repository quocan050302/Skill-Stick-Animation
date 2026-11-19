/**
 * Safe cross-platform original engine restorer (replaces hazardous tools/setup.sh).
 *
 * Provenance: NEW IMPLEMENTATION (independently authored for SHORT-01).
 * Safety guarantees:
 * - Never touches /tmp/_three, /tmp/_t3, or /tmp/_cas.
 * - Never mutates vendor/cartoon-short-kit/ preserved snapshot.
 * - Uses pinned local node_modules/three (0.160.0 MIT).
 * - Fetches mromidev/claude-animated-shorts templates/bridge/toon.ts into an isolated
 *   workspace/cache/cas-<uuid> directory, records exact commit SHA & file SHA-256,
 *   preserves upstream LICENSE notice, strips TypeScript types via Node 22+
 *   module.stripTypeScriptTypes, and builds engine/web/toonbase.js + roman.js -> toon.js.
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const UPSTREAM_CAS_REPO = 'https://github.com/mromidev/claude-animated-shorts.git';
const UPSTREAM_TOON_REL = path.join('templates', 'bridge', 'toon.ts');

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function copyVerified(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const raw = fs.readFileSync(src);
  fs.writeFileSync(dest, raw);
  const sHash = crypto.createHash('sha256').update(raw).digest('hex');
  const dHash = sha256File(dest);
  if (sHash !== dHash) {
    throw new Error(`Copy hash mismatch for ${dest}`);
  }
  return { src, dest, bytes: raw.length, sha256: dHash };
}

export function restoreOriginalEngine(projectRoot = ROOT) {
  const kitDir = path.join(projectRoot, 'vendor', 'cartoon-short-kit');
  if (!fs.existsSync(path.join(kitDir, 'engine', 'main.js'))) {
    throw new Error(
      `Preserved kit not found at ${kitDir}. Run python tools/setup/audit_kit.py --zip <zip> --skill-md <md> --preserve first.`
    );
  }

  const threeSrc = path.join(projectRoot, 'node_modules', 'three', 'build', 'three.module.js');
  if (!fs.existsSync(threeSrc)) {
    throw new Error('Pinned three@0.160.0 missing. Run npm ci first.');
  }

  const webDir = path.join(projectRoot, 'engine', 'web');
  const libDir = path.join(webDir, 'lib');
  fs.mkdirSync(libDir, { recursive: true });

  // 1. Copy original kit files byte-for-byte into engine/web/ (read-only from vendor/cartoon-short-kit/)
  const copies = [
    copyVerified(path.join(kitDir, 'engine', 'index.html'), path.join(webDir, 'index.html')),
    copyVerified(path.join(kitDir, 'engine', 'main.js'), path.join(webDir, 'main.js')),
    copyVerified(path.join(kitDir, 'engine', 'motion.js'), path.join(webDir, 'motion.js')),
    copyVerified(path.join(kitDir, 'engine', 'paint.js'), path.join(webDir, 'paint.js')),
    copyVerified(path.join(kitDir, 'engine', 'roman.js'), path.join(webDir, 'roman.js')),
    copyVerified(path.join(kitDir, 'example', 'soldier', 'story.js'), path.join(webDir, 'story.js')),
    copyVerified(threeSrc, path.join(libDir, 'three.module.js')),
  ];

  // Preserve Three.js MIT license notice
  const threeLicenseSrc = path.join(projectRoot, 'node_modules', 'three', 'LICENSE');
  const licensesDir = path.join(projectRoot, 'vendor', 'licenses');
  fs.mkdirSync(licensesDir, { recursive: true });
  if (fs.existsSync(threeLicenseSrc)) {
    copyVerified(threeLicenseSrc, path.join(licensesDir, 'THREE-0.160.0-LICENSE.txt'));
  }

  // 2. Fetch or reuse pinned mromidev/claude-animated-shorts toon.ts inside project-owned dir
  const upstreamDir = path.join(projectRoot, 'vendor', 'upstream', 'claude-animated-shorts');
  const toonTsDest = path.join(upstreamDir, 'toon.ts');
  const metaPath = path.join(upstreamDir, 'upstream-meta.json');
  let upstreamMeta = null;

  if (fs.existsSync(toonTsDest) && fs.existsSync(metaPath)) {
    upstreamMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } else {
    const cacheDir = path.join(projectRoot, 'workspace', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const cloneDir = path.join(cacheDir, `cas-${crypto.randomBytes(5).toString('hex')}`);
    try {
      execFileSync('git', ['clone', '--depth', '1', UPSTREAM_CAS_REPO, cloneDir], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
      });
      const commitSha = execFileSync('git', ['-C', cloneDir, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim();
      const toonSrc = path.join(cloneDir, UPSTREAM_TOON_REL);
      if (!fs.existsSync(toonSrc)) {
        throw new Error(`Expected ${UPSTREAM_TOON_REL} not found in ${UPSTREAM_CAS_REPO}`);
      }
      fs.mkdirSync(upstreamDir, { recursive: true });
      const copiedToon = copyVerified(toonSrc, toonTsDest);

      let licenseCopied = null;
      for (const cand of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
        const lp = path.join(cloneDir, cand);
        if (fs.existsSync(lp)) {
          copyVerified(lp, path.join(upstreamDir, cand));
          copyVerified(lp, path.join(licensesDir, 'CLAUDE-ANIMATED-SHORTS-LICENSE.txt'));
          licenseCopied = cand;
          break;
        }
      }

      upstreamMeta = {
        repo: UPSTREAM_CAS_REPO,
        commit_sha: commitSha,
        source_rel_path: 'templates/bridge/toon.ts',
        toon_ts_sha256: copiedToon.sha256,
        toon_ts_bytes: copiedToon.bytes,
        license_file: licenseCopied,
        fetched_at_utc: new Date().toISOString(),
      };
      fs.writeFileSync(metaPath, JSON.stringify(upstreamMeta, null, 2) + '\n', 'utf8');
    } finally {
      if (fs.existsSync(cloneDir)) {
        fs.rmSync(cloneDir, { recursive: true, force: true });
      }
    }
  }

  // 3. Strip TypeScript types using Node 22+ module.stripTypeScriptTypes -> toonbase.js
  // Node v26+ only accepts mode: 'strip' (original setup.sh passed mode: 'transform').
  if (typeof module.stripTypeScriptTypes !== 'function') {
    throw new Error('Node >=22.6 with module.stripTypeScriptTypes is required.');
  }
  const toonTsRaw = fs.readFileSync(toonTsDest, 'utf8');
  let toonBaseJs;
  let stripModeUsed = 'strip';
  try {
    toonBaseJs = module.stripTypeScriptTypes(toonTsRaw, { mode: 'strip' });
  } catch (err) {
    toonBaseJs = module.stripTypeScriptTypes(toonTsRaw, { mode: 'transform' });
    stripModeUsed = 'transform';
  }
  const toonBasePath = path.join(webDir, 'toonbase.js');
  fs.writeFileSync(toonBasePath, toonBaseJs, 'utf8');

  // 4. Concatenate toonbase.js + roman.js -> toon.js (matching original setup.sh line 19)
  const romanRaw = fs.readFileSync(path.join(webDir, 'roman.js'), 'utf8');
  const toonCombined = toonBaseJs + '\n' + romanRaw;
  const toonPath = path.join(webDir, 'toon.js');
  fs.writeFileSync(toonPath, toonCombined, 'utf8');

  const lock = {
    generated_at_utc: new Date().toISOString(),
    three: {
      version: '0.160.0',
      license: 'MIT',
      sha256: sha256File(path.join(libDir, 'three.module.js')),
      bytes: fs.statSync(path.join(libDir, 'three.module.js')).size,
    },
    claude_animated_shorts: upstreamMeta,
    built_modules: {
      toonbase_js: {
        sha256: sha256File(toonBasePath),
        bytes: fs.statSync(toonBasePath).size,
        command: `module.stripTypeScriptTypes(toon.ts, { mode: '${stripModeUsed}' })`,
      },
      toon_js: {
        sha256: sha256File(toonPath),
        bytes: fs.statSync(toonPath).size,
        command: 'concat(engine/web/toonbase.js, engine/web/roman.js)',
      },
    },
    copied_kit_files: copies.map((c) => ({
      dest: path.relative(projectRoot, c.dest).replace(/\\/g, '/'),
      bytes: c.bytes,
      sha256: c.sha256,
    })),
  };

  fs.writeFileSync(
    path.join(projectRoot, 'vendor', 'upstream-deps-lock.json'),
    JSON.stringify(lock, null, 2) + '\n',
    'utf8'
  );
  return lock;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const lock = restoreOriginalEngine(ROOT);
  console.log(JSON.stringify(lock, null, 2));
}
