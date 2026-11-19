# Visual & Screenshot Audit Ledger (`SHORT-02-20261119-01`)

All screenshots below are real headless Chromium captures verified via Playwright (`tests/e2e/test_studio_e2e.mjs`) with zero console errors, zero uncaught page errors, zero HTTP 5xx responses, zero horizontal overflow (`scrollWidth <= innerWidth`), and `>=40px` interactive hit targets across all viewports. Each image was directly opened and visually inspected via `read_file`.

| Artifact | Dimensions / Size | What Was Inspected & Verified |
| :--- | :--- | :--- |
| [01_projects_empty_1440x900.png](./screenshots/01_projects_empty_1440x900.png) | `1440×900` (`35,586 B`) | Clean dark empty state, restrained 2-tab topbar (`Dự án`, `Studio`), high contrast CTA. |
| [02_studio_desktop_1440x900.png](./screenshots/02_studio_desktop_1440x900.png) | `1440×900` (`234,412 B`) | Full uncropped project title, live 9:16 Three.js preview frame (Golden Hour `guardCap`), 3-tab right inspector (`Bối cảnh & Kịch bản`). |
| [03_studio_desktop_1280x800.png](./screenshots/03_studio_desktop_1280x800.png) | `1280×800` (`243,608 B`) | Clean 2-pane studio alignment at `1280×800`, crisp card contrast & alignment. |
| [04_studio_job_canceled_1440x900.png](./screenshots/04_studio_job_canceled_1440x900.png) | `1440×900` (`285,593 B`) | Real active job cancellation settling cleanly to `CANCELED` status in bottom `JobDrawer` + recoverable UI. |
| [05_studio_video_qa_1440x900.png](./screenshots/05_studio_video_qa_1440x900.png) | `1440×900` (`229,744 B`) | Exported `300`-frame `1080×1920` `<video>` player loaded on left stage, `Lời thoại & Thời lượng` + honest QA cards (`PASS` & `UNVERIFIED`), auto-collapsed compact bottom `JobDrawer` (`6.64 MB`). |
| [06_studio_tablet_1024x768.png](./screenshots/06_studio_tablet_1024x768.png) | `1024×768` (`227,431 B`) | Responsive Studio at `1024×768`, clear `WHOA!` comic overlay frame & shot inspector controls. |
| [07_studio_mobile_390x844.png](./screenshots/07_studio_mobile_390x844.png) | `390×844` (`131,748 B`) | Clean stacked mobile layout (`scrollWidth <= 390`), 44px controls, unobstructed preview stage. |
| [08_studio_mobile_320x720.png](./screenshots/08_studio_mobile_320x720.png) | `320×720` (`62,376 B`) | Smallest mobile width (`320px`) renders cleanly without horizontal scrolling or clipping. |
| [09_projects_grid_1440x900.png](./screenshots/09_projects_grid_1440x900.png) | `1440×900` (`37,660 B`) | Persisted project card with metadata (`1080×1920 · 300 khung · Rev #12 · MP4 đã xuất`). |
| [10_missing_kit_status_1280x800.png](./screenshots/10_missing_kit_status_1280x800.png) | `1280×800` (`53,991 B`) | Centered portal modal on isolated `noKitRoot`: `node OK v26.13.1`, `python OK`, `ffmpeg/ffprobe OK`, `INPUT_BLOCKED` warning for `engine/web/*`, and honest `three`/`playwright` status. |
| [proof_before_edit_f270.png](./screenshots/proof_before_edit_f270.png) & [proof_after_edit_f270.png](./screenshots/proof_after_edit_f270.png) | `172,048 B` vs `160,940 B` | Concrete before/after rendered pixel proof on Shot 4 (`f=270`) showing changed character, lighting, parcel, pose, expression, and closeup framing. |
| [demo_plaza_ui_300f_sheet.jpg](./demo_plaza_ui_300f_sheet.jpg) | `810×1440` (`282,954 B`) | 9-tile contact sheet across frames `0, 25, 74, 112, 165, 190, 235, 270, 295` of the full 300-frame UI-authored demo MP4. |
