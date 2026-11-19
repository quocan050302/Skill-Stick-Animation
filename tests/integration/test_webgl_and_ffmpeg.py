"""Real integration & negative tests: Playwright WebGL2 1080x1920, Pillow QA,
hash-validated RESUME, cancellation safety, and FFmpeg/FFprobe H.264/AAC export.

Note: Exercises TECHNICAL_WEBGL_SMOKE_ONLY and TECHNICAL_SYNTHETIC_FIXTURE — does NOT
claim original cartoon-short-kit Soldier parity or real voiceover narration parity.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "qa"))
sys.path.insert(0, str(ROOT / "tools" / "audio"))

import export_mp4  # noqa: E402
import mix  # noqa: E402
import verify_media  # noqa: E402


class TestWebGLAndFFmpegIntegration(unittest.TestCase):
    def test_real_webgl_smoke_pillow_qa_motion_and_ffmpeg_mp4(self) -> None:
        with tempfile.TemporaryDirectory(dir=str(ROOT / "workspace" / "cache")) as td:
            out_dir = Path(td)
            frames_dir = out_dir / "frames"

            # 1. Render 15 real 1080x1920 Three.js 0.160.0 WebGL2 frames via Playwright Chromium
            proc = subprocess.run(
                [
                    "node",
                    str(ROOT / "tools" / "render" / "webgl_smoke.mjs"),
                    "--out-dir",
                    str(frames_dir),
                    "--frames",
                    "15",
                ],
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, f"webgl_smoke failed:\n{proc.stderr}\n{proc.stdout}")
            smoke = json.loads(proc.stdout)
            self.assertEqual(smoke["label"], "TECHNICAL_WEBGL_SMOKE_ONLY")
            self.assertTrue(smoke["metadata"]["webgl"]["isWebGL2"])
            self.assertEqual(smoke["metadata"]["webgl"]["threeRevision"], "160")
            self.assertEqual(smoke["consoleErrors"], [])
            self.assertEqual(smoke["pageErrors"], [])
            self.assertTrue(smoke["deterministicRepeatMatch"])
            self.assertEqual(smoke["resumeSkippedCount"], 15)
            self.assertEqual(smoke["resumeRenderedCount"], 0)

            # 2. Decode every PNG frame with Pillow and assert 1080x1920 non-black visual signal
            frame_paths = sorted(frames_dir.glob("frame_*.png"))
            self.assertEqual(len(frame_paths), 15)
            for fp in frame_paths:
                img_qa = verify_media.inspect_image_frame(fp, expected_width=1080, expected_height=1920)
                self.assertTrue(img_qa["ok"], f"Frame QA failed: {img_qa}")
                self.assertFalse(img_qa["is_black_or_flat"])

            # 3. Verify genuine motion across frames (not frozen)
            motion = verify_media.inspect_frame_sequence_motion(frame_paths)
            self.assertGreater(motion["mean_mad"], 0.3)
            self.assertFalse(motion["freeze_threshold_exceeded"])

            # 4. Export SILENT technical MP4 and verify with FFprobe + FFmpeg null decode
            silent_mp4 = out_dir / "technical-smoke-silent.mp4"
            exp_silent = export_mp4.export_frames_to_mp4(frames_dir, silent_mp4, fps=30)
            self.assertEqual(exp_silent["mode_label"], "SILENT_TECHNICAL_MP4")
            probe_silent = verify_media.verify_mp4_with_ffprobe(
                silent_mp4,
                expected_width=1080,
                expected_height=1920,
                expected_fps=30.0,
                require_audio=False,
                expected_min_duration=0.45,
            )
            self.assertTrue(probe_silent["ok"], f"Silent MP4 probe failed: {probe_silent}")
            self.assertFalse(probe_silent["audio_present"])

            # 5. Export synthetic-audio muxed technical MP4 (H.264 + AAC) and verify FFprobe
            vo, mus, sfx = mix.generate_synthetic_technical_fixture(duration_seconds=0.6, sample_rate=48000)
            mixed, audio_metrics = mix.mix_linear_gated_rms(vo, mus, sfx, sample_rate=48000)
            self.assertAlmostEqual(audio_metrics["music_measured_ratio"], 0.5, delta=0.01)
            wav_path = mix.write_wav_pcm16(out_dir / "tech-mix.wav", mixed, sample_rate=48000)

            muxed_mp4 = out_dir / "technical-smoke-muxed.mp4"
            exp_muxed = export_mp4.export_frames_to_mp4(frames_dir, muxed_mp4, fps=30, audio_wav=wav_path)
            self.assertEqual(exp_muxed["mode_label"], "AUDIO_MUXED_MP4")
            probe_muxed = verify_media.verify_mp4_with_ffprobe(
                muxed_mp4,
                expected_width=1080,
                expected_height=1920,
                expected_fps=30.0,
                require_audio=True,
                expected_min_duration=0.45,
            )
            self.assertTrue(probe_muxed["ok"], f"Muxed MP4 probe failed: {probe_muxed}")
            self.assertEqual(probe_muxed["audio_codec"], "aac")
            self.assertTrue(probe_muxed["faststart"])

    def test_cancellation_and_corrupt_resume_re_render(self) -> None:
        with tempfile.TemporaryDirectory(dir=str(ROOT / "workspace" / "cache")) as td:
            frames_dir = Path(td) / "cancel-frames"
            node_script = f"""
            import fs from 'node:fs';
            import path from 'node:path';
            import {{ createRendererAdapter }} from './engine/adapters/renderer_adapter.mjs';

            const outDir = {json.dumps(str(frames_dir))};
            const adapter = createRendererAdapter(process.cwd());
            await adapter.initializeRenderer({{ projectId: 'cancel-resume-test', mode: 'technical_webgl_smoke' }});
            try {{
              const first = await adapter.renderFrameRange(0, 2, {{ outDir, format: 'png', resume: false }});
              // Corrupt frame 1 to prove RESUME validates hash/dimensions and re-renders only stale/corrupt frame
              fs.writeFileSync(path.join(outDir, 'frame_000001.png'), Buffer.from('corrupt-bytes'));
              const resumed = await adapter.renderFrameRange(0, 2, {{ outDir, format: 'png', resume: true }});

              // Test AbortController cancellation before frame 0
              const ac = new AbortController();
              ac.abort();
              let canceledCode = null;
              try {{
                await adapter.renderFrameRange(0, 2, {{ outDir, format: 'png', signal: ac.signal }});
              }} catch (err) {{
                canceledCode = err.code;
              }}
              console.log(JSON.stringify({{
                firstRendered: first.renderedCount,
                resumeSkipped: resumed.skippedViaResume,
                resumeRerendered: resumed.renderedCount,
                canceledCode,
              }}));
            }} finally {{
              await adapter.disposeRenderer();
            }}
            """
            proc = subprocess.run(
                ["node", "--input-type=module", "-e", node_script],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=90,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, f"cancel/resume script failed:\n{proc.stderr}\n{proc.stdout}")
            data = json.loads(proc.stdout.strip().splitlines()[-1])
            self.assertEqual(data["firstRendered"], 3)
            self.assertEqual(data["resumeSkipped"], 2)
            self.assertEqual(data["resumeRerendered"], 1)
            self.assertEqual(data["canceledCode"], "RENDER_CANCELED")

    def test_negative_corrupt_image_black_frame_and_ffmpeg_failure(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            # Corrupt image rejected
            corrupt = d / "corrupt.png"
            corrupt.write_bytes(b"broken-image-bytes")
            with self.assertRaises(verify_media.MediaVerificationError):
                verify_media.inspect_image_frame(corrupt)

            # Black 1080x1920 image flagged as black/flat
            black = d / "black.png"
            Image.new("RGB", (1080, 1920), (0, 0, 0)).save(black)
            qa_black = verify_media.inspect_image_frame(black)
            self.assertFalse(qa_black["ok"])
            self.assertTrue(qa_black["is_black_or_flat"])

            # FFmpeg failure on empty frames dir leaves no output MP4
            empty_dir = d / "empty_frames"
            empty_dir.mkdir()
            bad_mp4 = d / "should-not-exist.mp4"
            with self.assertRaises(export_mp4.ExportError):
                export_mp4.export_frames_to_mp4(empty_dir, bad_mp4, fps=30)
            self.assertFalse(bad_mp4.exists())


if __name__ == "__main__":
    unittest.main()
