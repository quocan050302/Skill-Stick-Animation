# Visual QA & Shot Audit (`How Mine Salting Worked` 4K + Visual A/B)

## 1. Automated Shot-Level Optical Verification (`out/short03a/mine-salting-shot-qa.json`)
- **Video Tested:** `out/short03a/how-mine-salting-worked-native-4k-vertical.mp4` (`600/600` frames, `2160×3840`, `20.00s @ 30fps`)
- **Defects Detected:** `black_frames = []`, `unplanned_white_frames = []`, `frozen_spans_ge12 = []`, `unplanned_pops = []`, `ok = true`.

| Shot | Frames | `luma_mean_median` | `luma_p2..p98` | `sat_mean_median` | `motion_mean_mad` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hook` | `0..93` | `0.2122` | `0.0667..0.6707` | `0.6257` | `1.823` |
| `secret` | `94..204` | `0.2026` | `0.0775..0.6807` | `0.6578` | `1.322` |
| `test` | `205..292` | `0.2212` | `0.0462..0.6650` | `0.6300` | `1.902` |
| `belief` | `293..383` | `0.2803` | `0.1033..0.7357` | `0.3738` | `2.058` |
| `check` | `384..478` | `0.1836` | `0.0534..0.5825` | `0.5982` | `1.633` |
| `payoff` | `479..599` | `0.2441` | `0.0798..0.7946` | `0.4479` | `1.144` |

## 2. Direct Visual Inspection Findings
- **Side-by-Side A/B (`out/short03a/visual-ab-comparison.jpg`):** Verified directly that `enhanced` integrates character cards seamlessly with real scene directional shadows (`getShadowMask()` shadow cut cleanly across Courier & Mine Investor, warm key rim lighting, grounded dynamic contact shadows) and that 1:1 `2160×3840` crops show razor-sharp ink outlines, hat geometry, and mineral crevices compared against blurry 1080p→2160p upscales.
- **28-Frame 4K Contact Sheet (`out/short03a/mine-salting-contact-sheet.jpg`) & Mobile 180px Thumbnails (`thumbnail-candidate-{a,b}.jpg`):** Zero cropped faces, zero double-arms, legible `"CLAIM #4 · SALTED ORE"`, `"SAMPLE #1 GOLD DUST"`, `"ASSAY 0%..RICH!"`, `"0% ORE"`, and `"BEDROCK CORE: 0.00%"` graphics, unobstructed clear sightlines in all 6 shots.
- **Human Final Visual Review:** Marked **`UNVERIFIED`** honestly pending direct video playback check by the user.
