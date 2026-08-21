# zero-trace-osint

Browser-only OSINT recon workbench. All recon queries execute directly from the client against public data sources; investigation state persists in browser IndexedDB. There is no backend, no account system, and no server-side logging component.

## Architecture

Single-page React application. Static build output only — any static file host can serve it.

```
src/
├── api/            Outbound data-source adapters (one file per source)
│   ├── ai.js           Anthropic messages API, direct browser call
│   ├── crtsh.js        Certificate transparency search (Web Worker + proxy fallback)
│   ├── dns.js          DNS-over-HTTPS (Google primary, Cloudflare fallback)
│   ├── exif.js         Local EXIF parsing via exifr
│   ├── gravatar.js     Avatar existence probe (MD5 hash)
│   ├── rdap.js         Registration data via RDAP protocol
│   ├── username.js     Profile probes against CORS-open platform APIs
│   └── wayback.js      Wayback Machine CDX + availability APIs
├── engine/         Pure logic, unit-tested, no DOM dependencies
│   ├── correlate.js    Deterministic entity-linking rules
│   ├── nextmoves.js    Pivot suggestion rules
│   ├── report.js       Markdown report builder + print pipeline
│   ├── timeline.js     Evidence chronology extraction
│   └── useRunner.js    Module registry + task/log orchestration hook
├── store/
│   ├── casefile.js     Zustand store: multi-case state machine
│   └── storage.js      IndexedDB access layer
├── workers/
│   └── crtsh.worker.js Off-main-thread fetch/parse for large CT responses
├── components/     UI layer (canvas, panels, modals)
└── utils/          kinds.js (entity taxonomy), crypto.js (vaults), md5.js
scripts/
└── selftest.mjs    Engine test suite (runs in Node, no browser required)
docs/
├── GAP-ANALYSIS.md Issue audit with resolution status
└── ROADMAP.md      Planned work by version
```

State management is a single Zustand store. Each case is one IndexedDB record containing nodes, edges, evidence chains, activity log, and an optional AI narrative. Node identity is deterministic (`kind:value`) so repeated scans deduplicate instead of duplicating entities.

## Recon modules

| Module | Source | Transport | Notes |
|---|---|---|---|
| DNS | dns.google, cloudflare-dns.com | DoH JSON API, CORS-open | A, AAAA, CNAME, MX, NS, TXT, SOA |
| WHOIS | rdap.org bootstrap | RDAP over HTTPS | Registrar, events, status, contacts, nameservers |
| Certificates | crt.sh | Direct, then CORS proxies | Runs inside a Web Worker; 150-subdomain cap |
| Archive | web.archive.org | CDX + availability API, CORS-open | Subdomain discovery from archived URLs |
| Username hunt | GitHub, GitLab, Reddit, npm, Keybase | Platform JSON APIs | Existence probing only where CORS permits |
| Image EXIF | local file | None (in-browser) | Camera, timestamps, exposure, GPS coordinates |
| Gravatar | gravatar.com | Image probe with d=404 | Avatar existence per email address |

Every finding written to the graph carries an evidence record: source identifier, detail string, timestamp, and source URL. Reports render these chains verbatim.

## Correlation

Two-stage design:

1. Deterministic rules (`engine/correlate.js`): email-domain to domain-node matching, username-to-account handle equality, shared IP addresses, shared nameservers. Each suggestion carries high/medium confidence.
2. Optional LLM pass (`api/ai.js`, Claude Haiku): fuzzy same-entity inference over the entity list. Requires a user-supplied Anthropic API key stored in localStorage; requests go browser-to-Anthropic using the `anthropic-dangerous-direct-browser-access` header.

Accepted suggestions become graph edges flagged `data.correlation` with the reasoning attached to both endpoints' evidence chains.

## Persistence and encryption

- Active case auto-saves (350 ms debounce) to IndexedDB database `zerotrace-workbench`, object store `cases`.
- Multiple cases supported; last-active pointer kept in `localStorage['zt-last-active']`.
- Plain export: `.zerotrace.json`.
- Encrypted export: `.ztvault.json` — AES-256-GCM, PBKDF2-SHA256 key derivation at 250,000 iterations, random 16-byte salt and 12-byte IV per vault (WebCrypto, `utils/crypto.js`). No password recovery exists.
- Imports always create a new case record; they never overwrite existing state.

## Getting started

Requirements: Node 18+ (developed on Node 24), npm.

```bash
npm install
npm run dev       # dev server on :5173
npm run test      # engine self-tests (Node, no browser)
npm run lint      # oxlint
npm run build     # production bundle -> dist/
npm run preview   # serve dist/ locally
```

## Deployment

`dist/` is fully static. Repository includes configs for both:

- Netlify: `netlify.toml` (build command, publish dir, SPA redirect)
- Vercel: `vercel.json`

Vite `base` is set to `'./'` so the build also works from subpath hosting such as GitHub Pages.

## PWA

Production builds register a service worker (`public/sw.js`): network-first navigation with offline fallback, stale-while-revalidate for same-origin assets. The app installs to desktop/home-screen via `public/manifest.webmanifest`.

## Testing

`scripts/selftest.mjs` exercises the pure engines without a browser: input normalization, correlation rules, report builders, MD5 vectors (RFC 1321 plus UTF-8 multibyte), CDX response parsing, pivot-suggestion rules, timeline extraction, and vault encrypt/decrypt round-trip including wrong-password rejection.

## Known limitations

Documented in `docs/GAP-ANALYSIS.md`; forward plan in `docs/ROADMAP.md`. Summary: username enumeration covers five platforms (CORS-constrained), breach-data lookup is not integrated, canvas lacks undo/search, PDF output relies on the browser print pipeline.

## Legal

For authorized security research, CTF use, and education. Users are responsible for compliance with applicable law and the terms of service of every queried data source.

## License

MIT — see [LICENSE](LICENSE).
