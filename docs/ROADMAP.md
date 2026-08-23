# Roadmap — Zero-Trace Workbench

## v1.0 (shipped)
- Multi-case management: Home screen, create / open / delete / auto-switch, legacy-data migration
- Next-moves copilot (rules-based pivot suggestions with one-click execution)
- Timeline modal (milestones + scan history, chronological)
- Wayback Machine module (CDX subdomain discovery, snapshot availability evidence)
- Gravatar module (avatar-existence probe per email)
- Web Worker for crt.sh scans (UI stays responsive)
- PWA: installable, offline app-shell for viewing saved cases
- Per-case persisted activity logs; imports always create new cases
- Expanded self-test suite (`npm run test`)

## v1.1 (shipped)
- [x] Graph search / quick filter — Ctrl+K palette (`components/canvas/QuickSearch.jsx`), keyboard-driven jump-to-node with viewport centering
- [x] Edge relationship labels — `edgeLabelFor()` in `utils/kinds.js`; scan-created edges labeled resolves-to / subdomain-of / delegates-to / registrant-contact / found-on; correlation edges labeled correlated
- [x] Undo/redo stack — 50-step history in `store/casefile.js` covering structural changes (nodes, edges, findings, links); Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y plus toolbar buttons
- [x] Node context menu — right-click any node for module pivots, copy value, delete (`components/canvas/NodeContextMenu.jsx`)
- [x] Export graph as PNG snapshot — toolbar button using html-to-image over the react-flow viewport (`components/canvas/CanvasToolbar.jsx`)
- Premium light redesign: black-on-white design system in `src/index.css` (frosted glass panels, spring micro-interactions, animated modals/palette/context menu, reduced-motion support)

Still open from v1.1:
- [ ] True PDF file generation (print-dialog flow remains; jsPDF intentionally not added)

## v1.2 (shipped)
- [x] Exposure upgrade — all key-free: XposedOrNot breach check + analytics (risk label, data types, paste count), Hudson Rock infostealer-log checks for email & username, HIBP public domain-catalog with XposedOrNot fallback
- [x] Phone Intel module (`api/phone.js`) — offline libphonenumber parse (validity, country, line type, formats), live carrier/timezone/disposable enrichment via phone-number-api.com, one-click pivot deep-links (Truecaller, Sync.me, WhatsApp, multi-format Google/Bing/DDG/Yandex dorks, DeHashed)
- [x] `intel` status in evidence chain; pivot links render as clickable chips in Inspector

Still open from v1.2:
- [ ] Optional Cloudflare Worker relay → unlocks Sherlock-scale username enumeration + removes CORS-proxy dependence for crt.sh + enables keyed HIBP calls server-side
- [ ] More username platforms via the relay
- [ ] GitHub enrichment: commit-email harvesting, org membership
- [ ] Shareable read-only case links encoded entirely in the URL fragment (still server-less)

## v2 ideas (vision)
- [ ] Risk/exposure scoring in reports (PRD non-goal for v1, revisit)
- [ ] Reverse-image AI tagging
- [ ] Bulk entity import (CSV of emails/domains)
- [ ] Component + E2E test suite (Playwright)
