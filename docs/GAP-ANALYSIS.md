# Gap Analysis — Zero-Trace Workbench v0.x → v1.0

Audit date: 2026-08-22. Each issue is pinned to its location in the codebase, rated by severity, and tracked to resolution.

---

## G-01 · Only one case can exist — "case files" were false advertising
- **Where:** `src/store/casefile.js` (single hardcoded `'current'` IDB key), `newCase()` action
- **Severity:** Critical (product-defining feature missing)
- **Impact:** Clicking *New case* silently wiped the user's graph. No way to keep two investigations side by side, which was the entire "local-first case files" pitch.
- **Status:** ✅ FIXED in v1.0 — store rewritten around a case index (`hydrate()` loads all records via `loadAllCases()`); new Home screen (`src/components/Home.jsx`) lists cases with create / open / delete; imports now spawn a **new** case instead of overwriting; last-active case remembered in `localStorage['zt-last-active']`. Legacy single-case data under the old `'current'` key is migrated automatically.

## G-02 · The AI copilot (next-pivot suggestions) never existed
- **Where:** missing entirely (only correlation half was built in `src/engine/correlate.js`)
- **Severity:** High — this was differentiator #2 in the product pitch
- **Status:** ✅ FIXED in v1.0 — `src/engine/nextmoves.js` rules engine proposes ranked next actions (missing WHOIS/DNS/certs/Wayback on domains, Gravatar check on emails, unlinked account handles, email domains not yet investigated). Rendered by `src/components/NextMoves.jsx` with one-click Run / Dismiss.

## G-03 · Timeline view promised, never built
- **Where:** missing (listed in implementation plan Phase 4)
- **Severity:** Medium
- **Status:** ✅ FIXED in v1.0 — `src/engine/timeline.js` extracts milestone dates (registration/expiration from RDAP evidence, capture dates from EXIF) plus every scan event; `src/components/TimelineModal.jsx` renders the chronology.

## G-04 · Data-source depth too thin (5 platforms, no archive/avatar intel)
- **Where:** `src/api/username.js`
- **Severity:** Medium
- **Status:** ⚠️ PARTIALLY FIXED in v1.0 — added **Wayback Machine** module (`src/api/wayback.js`, CDX subdomain discovery + snapshot evidence) and **Gravatar** check (`src/api/gravatar.js`, MD5-hash avatar probe). Platform count for username hunt remains 5 (CORS-limited); expansion tracked in roadmap.

## G-05 · Heavy scans freeze the UI thread
- **Where:** `src/api/crtsh.js` parsed multi-MB JSON responses on the main thread
- **Severity:** Medium
- **Status:** ✅ FIXED in v1.0 — crt.sh fetch + JSON parse moved into a module Web Worker (`src/workers/crtsh.worker.js`) with automatic inline fallback when workers are unavailable.

## G-06 · Not installable, not offline-capable
- **Where:** no manifest / service worker
- **Severity:** Medium (part of the zero-trace story: view saved cases with no network)
- **Status:** ✅ FIXED in v1.0 — PWA added: `public/manifest.webmanifest`, `public/sw.js` (network-first navigation with offline fallback, stale-while-revalidate assets), installable via `public/icon.svg`.

## G-07 · Imports destroyed the working case
- **Where:** old `importJson()` replaced active state unconditionally
- **Severity:** High (data loss foot-gun)
- **Status:** ✅ FIXED in v1.0 — every import creates a new case record.

## G-08 · Case activity log was global & ephemeral
- **Where:** `log` lived outside the persisted payload
- **Severity:** Low — but it broke the CTF writeup's methodology section across sessions
- **Status:** ✅ FIXED in v1.0 — log is stored per case and persisted with it.

## G-09 · Pivot buttons hardcoded in three places
- **Where:** `Sidebar.jsx`, `Inspector.jsx`, `useRunner.js` each listed modules manually
- **Severity:** Low (maintenance hazard — adding Wayback would have required three edits)
- **Status:** ✅ FIXED in v1.0 — `MODULES` registry in `useRunner.js` is the single source of truth; Inspector renders pivots from it.

## G-10 · Engine logic untested until late; a real bug shipped
- **Where:** `normalizeValue()` did not lowercase domains — `Example.com` and `example.com` produced duplicate nodes (caught by `scripts/selftest.mjs`)
- **Severity:** High (silent data corruption), fixed during Milestone 6 verification
- **Status:** ✅ Tests expanded in v1.0: MD5 vectors, CDX parsing, next-move rules, timeline extraction.

---

## Still open (accepted limitations, see ROADMAP.md)
- Username hunt covers 5 CORS-open platforms (Sherlock-class coverage needs a proxy worker)
- HIBP breach lookup for email covered key-free via XposedOrNot (+ Hudson Rock stealer logs); HIBP's own keyed API remains proxy-only (no CORS by policy)
- True PDF generation still uses the browser print dialog (v1.1 shipped PNG graph export instead; jsPDF deliberately not added to keep the bundle lean)
- No component/E2E tests; only engine-level self-tests

## v1.1 resolutions
- ✅ Undo/redo: 50-step structural history (`store/casefile.js`), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y + canvas toolbar
- ✅ Graph search: Ctrl+K quick-jump palette (`components/canvas/QuickSearch.jsx`)
- ✅ Edge relationship labels: `edgeLabelFor()` (`utils/kinds.js`), applied at edge creation in `addFindings` / `linkNodes`
- ✅ Node context menu: right-click pivots / copy / delete (`components/canvas/NodeContextMenu.jsx`)
- ✅ PNG graph export: toolbar button (`components/canvas/CanvasToolbar.jsx`, html-to-image)
