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

## v1.1 candidates (near term)
- [ ] Graph search / quick filter (jump to node by name)
- [ ] Edge relationship labels ("resolves-to", "registrant-of", "correlated")
- [ ] Undo/redo stack for canvas operations
- [ ] True PDF file generation (replace print-dialog flow)
- [ ] Node context menu (right-click: pivot modules, copy, delete)
- [ ] Export graph as PNG snapshot

## v1.2 candidates (depth)
- [ ] HIBP breach lookup behind BYO key (like the Claude key pattern)
- [ ] Optional Cloudflare Worker relay → unlocks Sherlock-scale username enumeration + removes CORS-proxy dependence for crt.sh
- [ ] More username platforms via the relay
- [ ] GitHub enrichment: commit-email harvesting, org membership
- [ ] Shareable read-only case links encoded entirely in the URL fragment (still server-less)

## v2 ideas (vision)
- [ ] Risk/exposure scoring in reports (PRD non-goal for v1, revisit)
- [ ] Reverse-image AI tagging
- [ ] Bulk entity import (CSV of emails/domains)
- [ ] Component + E2E test suite (Playwright)
