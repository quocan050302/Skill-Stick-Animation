# Audio Generation, Linear -6 dB Mix & Strict QA Audit (`SHORT-03A`)

## 1. Phase H Audio QA False-PASS Bug Fix
- **Defect Identified (`QA @ 00c559ba`):** `app/server/services/qa_service.mjs::summarizeQAGates` previously allowed `audio_track` to fall back to `PASS` via `hasAudioTrack === true` even when `audioMetrics.music_measured_ratio` was missing, `NaN`, or outside `-6.02 dB` (`0.50 ± 0.025`).
- **Fix Implemented:** Extracted `evaluateAudioMixGate({ hasAudioTrack, hasVoiceover, audioMetrics })` in `app/server/services/qa_service.mjs`:
  - `hasVoiceover === false`: returns **`UNVERIFIED`** honestly (tracks present without human/synthesized voiceover metrics cannot claim mix compliance).
  - `hasVoiceover === true`: requires valid AAC stream, finite `music_measured_ratio` within `0.50 ± 0.025`, finite `narration_gated_rms > 1e-6`, and `all_samples_finite !== false`. Rejects invalid/missing cases as **`FAIL`**.
  - **Negative Unit Tests Verified:** Covered in `tests/unit/test_short03a_visual_and_4k.mjs` (`ratio=0.8`, `NaN`, missing metrics, zero-RMS voice, absent stream, no-voiceover bed, valid `0.5006`).

## 2. "How Mine Salting Worked" (20s) Original Audio Track
- **Narration Provenance:** Local offline Windows SAPI5 (`System.Speech.Synthesis.SpeechSynthesizer`, voice `Microsoft David Desktop`, `en-US`, un-accelerated `Rate = 0`) synthesized beat-by-beat (`tools/audio/generate_mine_narration.ps1`), resampled to `48000 Hz` stereo PCM16, and assembled with measured silence trimming (`tools/audio/build_mine_audio.py`). *(Note: Explicitly documented as local SAPI5 TTS — not claimed as human studio voice recording; paid external TTS/voice-cloning APIs are not used.)*
- **Music & SFX Stems (`tools/audio/template_audio.py` -> `_synth_mine_salting_stems`):** Frontier D-minor acoustic pluck bed + timed mine clinks, dust brush sweep, three gold nugget drops, celebratory brass balance triad, deep bedrock chisel thuds, and payoff reveal toll.
- **Linear Gated-RMS Mixing (`tools/audio/mix.py`, no dynamic ducking):**
  - `sample_rate`: `48000 Hz`, `channels`: `2`, `samples`: `960000` (`20.0s`)
  - `narration_gated_rms`: `0.101655` (`narration_active_ratio = 0.7925`)
  - `music_target_ratio`: `0.50` -> `music_measured_ratio`: **`0.500603`** (`-6.0101 dB` relative to gated narration RMS)
  - `limiter_engaged`: `false`, `final_peak`: `0.943841` (`master_peak_cap = 0.96`), `clipped_samples`: `0`
  - **EBU-R128 Inspection (`ffmpeg ebur128`):** Integrated **`-16.9 LUFS`**, **`LRA = 1.4 LU`**, True/Sample Peak **`-0.6 dBFS`**, `silence_events = []`.
