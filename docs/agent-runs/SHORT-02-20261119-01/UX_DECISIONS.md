# UX & Visual Design Decisions (`SHORT-02`)

1. **Dark-Neutral Studio Aesthetic (`src/styles/tokens.css`):**
   - Background `#0E1116`, cards `#171C24`, elevated controls `#202734`, subtle hairline border `#303A48`, primary text `#F0F3F7`, secondary muted text `#AAB6C5`, accessible lavender-blue accent `#8BA6F3` paired with dark ink text `#0B111C` (contrast > 8:1).
   - Strict zero-gradient flat/architectural hierarchy avoiding neon gradients or fake dashboard KPI clutter.
2. **Navigation & Layout Restraint:**
   - Top header exposes only **Dự án** (`ProjectsPage`) and **Studio** (`ShortPreview` + `ShotInspector`), plus one compact Engine readiness pill opening a diagnostic dialog.
   - Right inspector groups parameters cleanly into **3 focused tabs** (`Cảnh & Máy quay`, `Bối cảnh & Kịch bản`, `Lời thoại & Thời lượng`) instead of 3 side-by-side crowded columns.
   - Left preview stage holds a strict `9:16` viewport switching cleanly between live Three.js frame scrubbing and the exported `<video>` MP4 player.
3. **Vietnamese UI First & Accessible Hit Targets:**
   - All buttons, selects, and text controls enforce `min-height: 44px`, validated dynamically across `1440×900`, `1280×800`, `1024×768`, `390×844`, and `320×720` with zero horizontal overflow (`scrollWidth <= innerWidth`).
   - Clear visible keyboard focus outlines (`:focus-visible`), `Escape` dismissal for all dialogs, inline confirmation modal for delete (never browser `window.confirm`), and `@media (prefers-reduced-motion: reduce)`.
4. **Issues Caught & Fixed During Real Screenshot Inspection:**
   - **Sticky `backdrop-filter` Modal Trap (`EngineStatus.tsx`):** Opening the Engine Status dialog inside `<header className="topbar">` caused Chromium to trap `position: fixed` relative to the sticky header. Resolved via `createPortal(..., document.body)`.
   - **Mobile `JobDrawer` Coverage (`JobDrawer.tsx` & `app.css`):** Capped drawer height to `44vh` with internal scroll and auto-collapsed completed jobs to a slim bottom summary strip.
   - **Long Custom Sign & Title Clipping (`paint_plaza.js`, `app.css`):** Added `ctx.measureText` auto-scaling in `plazaSign` (`up to 18 chars`) and expanded desktop `.title-input` to `clamp(220px, 34vw, 440px)`.
   - **Cancellation Race (`App.tsx`):** Added `mergeMonotonicJob` so delayed `POST /cancel` responses returning `canceling` never overwrite terminal `canceled` events received via SSE.
