# VeilTrace Workbench

> **Private OSINT investigation workbench. Runs entirely in the browser. No backend, no logs, no accounts. Graph-first recon with full evidence trails and verifiable exposure checks.**

[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind + shadcn](https://img.shields.io/badge/UI-Tailwind_shadcn-black)](https://ui.shadcn.com)
[![License MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Browser_Only-black)](#transparency--data-sources)
[![PWA](https://img.shields.io/badge/PWA-Installable-blue)](public/manifest.webmanifest)

**Live:** `npm run dev` → http://localhost:5173. App shell and saved cases work offline after first load. All scans require network. `dist/` is static and deploys to Netlify, Vercel, or GitHub Pages.

---

## ⚠️ HONEST WARNINGS — READ BEFORE TRUSTING VEILTRACE

VeilTrace is private **from VeilTrace** (there is no VeilTrace server). It is **not anonymous**, **not encrypted by default**, and **not a guarantee of any kind**. These are real gaps, not marketing fine print:

1. **Your queries leave your device.** Checking an email sends that email to XposedOrNot / Hudson Rock / HIBP. A DNS scan sends the domain to Google/Cloudflare. A phone lookup sends the number to phone-number-api.com. With an AI key set, entity labels go to Anthropic. Those providers see what you investigate and operate under their own logging/privacy policies — which VeilTrace does not control.
2. **CORS proxies can see your requests.** When crt.sh is blocked, requests route through third-party public proxies (`corsproxy.io`, allorigins, corsfix, yacdn). The chain becomes *you → proxy → crt.sh*. Proxies are an availability fallback only — they are NOT part of the privacy model.
3. **Local Lock ≠ encryption.** The start-up password gates the UI in that browser only. Case data in IndexedDB is plaintext on disk. Only a Vault export (`.vtvault.json`) encrypts data (AES-256-GCM).
4. **"No result" ≠ safe.** If providers are blocked or rate-limited, a missing breach record may mean "couldn't check", not "not breached". Coverage panel and logs flag unavailable sources; reports list them explicitly.
5. **Username results can be false positives.** Low-confidence platforms return HTTP 200 for missing accounts (SPAs, soft-404s). Every probe records its method + confidence; treat Low as a lead, never as fact.
6. **Correlations and AI links are leads, not proof.** Rules encode heuristics (shared IP, handle match). AI output is labeled "suggestion — unverified". Nothing in VeilTrace confirms identity.
7. **Keys sit in localStorage.** Anthropic/HIBP keys are stored unencrypted in the browser. A compromised device/profile exposes them. Rotate if in doubt.
8. **Offline means local-only.** Offline you can view cases, graph, reports, EXIF, offline phone parse. You cannot scan anything. No offline cache of external results beyond what was already saved in the case.
9. **Dependency risk is structural.** No backend also means no control: any provider can change API/CORS/rate limits and break a module. crt.sh already needs 5-route fallbacks.
10. **Not legal advice, not OPSEC.** Public information ≠ permission to investigate. VeilTrace does not hide *you* from the sites you query; use appropriate infrastructure for your threat model.

If any of these matter for your use case, resolve them before relying on VeilTrace.

---

### What VeilTrace Does

VeilTrace is a local-first workbench for OSINT recon. Enter a domain, email, username, phone, name, or image. The app queries public sources directly from the browser, renders every finding as a node on an interactive graph, and lets the operator pivot, correlate, verify, and export.

The core flow is **Discover → Correlate → Verify → Exposure → Pivot → Report**. Every finding retains its source, timestamp, resolver, TTL, raw data, and URL.

No data is sent to a VeilTrace server. There is no VeilTrace server.

---

### Audience

- CTF players needing fast recon and one-click writeups
- Students learning real investigative workflows visually
- Researchers and analysts requiring privacy for their own trace
- Individuals verifying their own exposure in public breach data

---

### Capabilities

| Action | Result | Example |
|---|---|---|
| **DNS** | A, AAAA, CNAME, MX, NS, TXT, SOA with TTL, resolver, query, time, raw→normalized, deduped IPs clustered | `example.com` → `TTL 300s via dns.google` |
| **WHOIS / RDAP** | Registrar, status, events, contacts, nameservers | `RDAP: Registered 1995-08-27` |
| **Certificates** | Hidden subdomains from CT logs, 5-route fallback, worker-parsed | `api.example.com` from crt.sh |
| **Wayback** | Archived URLs and hostnames via CDX | `2 archived hosts` |
| **Username hunt** | 18 platforms via open APIs (GitHub, GitLab, Reddit, npm, Keybase, HN, Dev.to, PyPI, Docker Hub, etc.) | `github/jdoe` hit |
| **Email** | Contact extraction via RDAP, Gravatar probe (MD5) | `5d4140… → avatar found` |
| **Dork generator** | Google/Bing/DDG/Yandex dorks per entity (no key, no network) | `site:example.com` |
| **Image drop** | EXIF via `exifr` locally — camera, lens, GPS, capture time — never uploaded | `GPS 12.34, 56.78` |
| **Exposure** | Breach + infostealer checks, phone intel (offline + live), image hash | See Transparency table |
| **Correlate** | Deterministic rules (shared IP/NS, email→domain, handle match) + optional Claude pass | `High / Medium / Low + reason` |
| **Timeline** | Chronological view with range and milestone filters | `Registered — example.com` |
| **Report** | Analyst, CTF, Abuse templates — Markdown + Print/PDF, evidence and exposure sections | One click |
| **Canvas** | Infinite graph, mini-map, search `Ctrl+K`, right-click pivots, undo `Ctrl+Z`, PNG export | Drag to link |

Every edge is labeled: `resolves-to`, `has-subdomain`, `delegates-to`, `registrant-contact`, `found-on`, `handle-of`, `hosted-at`, `mentions-email`, `related-to`, `exposed-in`, `affects`, `correlated`, `dork`.

---

### Exposure Module

VeilTrace shows breach name, date, data classes, source, confidence, and severity. Raw passwords, tokens, and cookies are never displayed.

Statuses are explicit:

- **Confirmed** — provider confirms this exact value in a breach
- **Possible** — name/phone/domain-wide match, not unique
- **No result** — provider reports no known exposure
- **Intel** — context (risk, carrier, pivots), not a verdict
- **Provider unavailable** — CORS or rate limit blocked, with manual check URL

All exposure checks run key-free in the browser except the optional HIBP and Anthropic extras.

---

### Transparency — Data Sources

**VeilTrace sends nothing to VeilTrace (no such server exists). External providers DO receive the queries required to run each check.** Examples: an email exposure check sends that email to the breach provider; a phone lookup sends the number to the carrier-lookup API; an AI pass sends entity labels to Anthropic. Each row below states exactly what leaves the browser.

All network calls originate from the browser tab. Closing the tab stops all traffic. crt.sh fallback proxies are availability workarounds, not privacy features — treat proxy-routed requests as visible to the proxy operator.

| Module | Provider & Endpoint | Data Sent | Key | CORS | Rate Limit | Notes |
|---|---|---|---|---|---|---|
| **DNS** | `https://dns.google/resolve` and `https://cloudflare-dns.com/dns-query` (DoH JSON) | Domain string | None | Yes | Provider-enforced | Dual resolver, 10s timeout, TTL+resolver recorded |
| **WHOIS RDAP** | `https://rdap.org/domain/{domain}` | Domain string | None | Yes | Provider-enforced | Follows redirects, extracts vCard and events |
| **Certificates** | `https://crt.sh/?q={domain}&output=json` via 5 routes (direct + 4 CORS proxies) | Domain string | None | Via proxies when blocked | Provider-enforced | Parsed in Web Worker `src/workers/crtsh.worker.js` |
| **Wayback** | `https://archive.org/wayback/available` and `https://web.archive.org/cdx/search/cdx` | Domain string | None | Yes | Provider-enforced | CDX hostname filter |
| **Username** | `api.github.com`, `gitlab.com/api/v4`, `reddit.com`, `registry.npmjs.org`, `keybase.io`, `hacker-news.firebaseio.com`, `dev.to`, `pypi.org`, `hub.docker.com`, etc. (18 total) | Username string | None | Varies per provider | Per-provider | `src/api/username.js` — `false`=not found, `null`=inconclusive |
| **Gravatar** | `https://www.gravatar.com/avatar/{md5}?d=404` | MD5 of lowercased email (not plaintext) | None | Yes | Provider-enforced | Image probe, 8s timeout `src/api/gravatar.js` |
| **Email breach** | `https://api.xposedornot.com/v1/check-email/{email}` and `v1/breach-analytics?email=` | Email (lowercased) | None | Yes | 2/s, 25/h, 100/d | Parallel with Hudson Rock `src/api/exposure.js` |
| **Stealer logs (email/username)** | `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-{email,username}` | Email or username | None | Yes | Provider-enforced | Never shows credentials |
| **Domain breach catalog** | `https://haveibeenpwned.com/api/v3/breaches?domain={domain}` and fallback `api.xposedornot.com/v1/breaches?domain=` | Domain string | None | HIBP catalog is `*` CORS; XON is fallback | Provider-enforced | HIBP keyed `breachedaccount` is intentionally not used from browser (no CORS by policy) |
| **Phone offline** | `libphonenumber-js` in-browser | None (local) | None | N/A | N/A | Validity, line type, E.164/international/national/RFC3966 |
| **Phone live** | `https://demo.phone-number-api.com/json/?number={e164}` | E.164 without `+` | None | Yes | 5/min free | Carrier, timezone, region, disposable flag. Offline result remains if this fails |
| **Phone pivots** | Truecaller, Sync.me, `wa.me`, Google/Bing/DDG/Yandex, DeHashed, HIBP (links only) | Click opens link in new tab | None | N/A (user-initiated) | N/A | Shown as chips in Inspector |
| **Image EXIF** | `exifr` in-browser | None (local) | None | N/A | N/A | Camera/lens/GPS/date, `src/api/exif.js` |
| **Image hash** | `crypto.subtle.digest(SHA-256)` local, VirusTotal link `https://www.virustotal.com/gui/search/{hash}` | None until user clicks link | None | N/A | N/A | Hash displayed locally |
| **Dork generator** | No network — URL builder `src/api/dorks.js` | None until click | None | N/A | N/A | Opens Google/Bing/DDG/Yandex in new tab |
| **AI correlation + summary** | `https://api.anthropic.com/v1/messages` with `anthropic-dangerous-direct-browser-access: true` | Summarized entity list (kind+label, up to 150) | Yes — user BYO Anthropic key (`localStorage zt-anthropic-key`) | Yes | Anthropic account limits | Optional, never called without a key `src/api/ai.js` |
| **Optional HIBP fallback** | `https://haveibeenpwned.com/api/v3/breachedaccount/{email}` | Email | Yes — HIBP key (`zt-hibp-key`) | No (keyed endpoint blocks browsers by design → shows provider unavailable) | HIBP policy | Not a parallel provider; XposedOrNot remains primary |
| **Local lock** | `localStorage veiltrace-lock-salt/hash` (PBKDF2 250k, local only) | Password hash only | None | N/A | N/A | One-time browser gate, shown once for internal sharing. Change in Settings |

No analytics, no telemetry, no cookies. Keys live only in `localStorage` (unencrypted — see warning #7). Clearing site data removes everything.

---

### Design

Black-on-white, Apple-inspired. Frosted glass, hairline borders, spring motion, `shadcn/ui` + Tailwind 4. Dense where needed, airy where it counts. Dark mode via `prefers-color-scheme` and manual toggle. `Lenis` smooth scroll, `React Flow` canvas at refresh rate, `50-step` undo, `Ctrl+K` search, context menus, PNG export. Mobile is a first-class shell: top bar, bottom dock (Tools / Graph / Details / Log), left/right drawers, collapsible execution sheet with up/down controls, 44px touch targets, safe-area insets, fluid `dvh/svh`.

---

### Architecture

```
src/
  api/        dns, rdap, crtsh, wayback, username (18), exif, gravatar, dork, exposure (XON/Hudson/HIBP/phone), phone, ai
  engine/     correlate (rules + AI), nextmoves, timeline, report (analyst/ctf/abuse), useRunner (MODULES registry)
  store/      Zustand + IndexedDB (veiltrace-workbench), 50-step history, last-active case
  workers/    crtsh.worker.js (CT parsing off main thread)
  components/ Sidebar (Investigate/Build/Intel + Exposure), Inspector (TTL/resolver/dorks/phone/reverse-image), Terminal (execution table), canvas (FlowCanvas, EntityNode, NodeContextMenu, CanvasToolbar, QuickSearch), mobile (MobileNav), legal, ui
  utils/      kinds (normalize + id + edge labels), crypto (AES-256-GCM PBKDF2 250k), md5
public/      manifest.webmanifest, sw.js (network-first nav, offline shell), icon.svg
```

A node is `kind:value` (`domain:example.com`, `breach:Collection #1`) — deterministic dedup. Evidence is appended per finding with `at, source, detail, url, meta`.

Build is `Vite 6+` + `React 19` + `Tailwind 4`. No backend exists.

---

### Build From Source

Requirements: Node 18+ (tested on 24).

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 34 engine checks, no browser
npm run lint       # oxlint
npm run build      # → dist/ static
npm run preview    # serve dist/ locally
```

Deploy `dist/` to any static host. Configs included: `netlify.toml`, `vercel.json`, `base: './'` for GitHub Pages.

---

### Collaborate

Contributions are welcome. The goal is to keep VeilTrace private, verifiable, and fast.

**Ways to contribute**

- Fix a bug or polish mobile/browser quirks
- Add a CORS-open data source with evidence and docs
- Improve correlation rules or next-move suggestions
- Add tests in `scripts/selftest.mjs` or Playwright E2E
- Improve docs, types, or a11y

**Process**

1. Fork and branch from `main`
2. Run `npm install && npm run test && npm run lint && npm run build` before pushing
3. Keep changes focused. One feature or fix per pull request
4. Include evidence examples and update the Transparency table when adding a source
5. For new modules, register in `src/engine/useRunner.js` `MODULES` — the single source of truth for pivots
6. For UI changes, test at `320px`, `768px`, `1024px`, and `1440px` with both themes

**Conventions**

- Direct, verifiable language in code and docs. No indirect requests or open questions in UI copy
- Evidence first: every finding must carry source, time, and URL
- Privacy first: no outbound call without user action. No tracking
- Performance: heavy parsing in workers, lazy-load heavy modals

**Local development tips**

- Use `zt-anthropic-key` and `zt-hibp-key` in `localStorage` for optional AI/HIBP. Everything else works without keys
- `IndexedDB` database is `veiltrace-workbench` (legacy `zerotrace-workbench` is migrated automatically)
- Clear data: DevTools → Application → IndexedDB / Local Storage → Clear site data

---

### Local Lock — One-Time Browser Gate

VeilTrace gates the workbench with a local password on first start. The flow is browser-only.

- On first launch, set a local password (min 8 chars). It is hashed with PBKDF2 250k + random salt and stored in `localStorage` of this browser. No server.
- The password is shown once for internal sharing. Copy it over a private channel — it will not be shown again.
- Each browser has its own gate. Team members set their own passwords on their own browsers. The gate does not sync or leave the device.
- Change or remove the gate anytime in Settings → Local lock (requires current password, or reset).
- Resetting the gate does not delete cases. Forgetting the password requires reset.

This gate protects browser storage only. It does not encrypt cases at rest — use Vault export for encrypted at-rest storage.

### Case Files

- Auto-save every 350ms to `IndexedDB`
- Multiple cases, last-open remembered
- Export plain `.veiltrace.json` (also imports legacy `.zerotrace.json`)
- Export vault `.vtvault.json` — AES-256-GCM, PBKDF2 250k, random salt & IV (Web Crypto). No recovery
- Import always creates a new case

PWA: install to desktop, view saved cases offline.

---

### Limits

- Username hunt: 18 platforms in-browser. Full Sherlock-scale requires a relay worker. Platform results carry method + confidence (High = API that 404s on absence; Low = HTML probe on soft-404 sites) — see Coverage panel legend
- Exposure: HIBP keyed `breachedaccount` and username catalog remain proxy-only by provider policy — shown as provider unavailable, never faked. Unavailable providers make the result INCOMPLETE, not clean
- Negative evidence is recorded: platforms checked with no account found are kept per-handle and listed in reports ("checked and produced no matching result")
- Investigation Coverage panel (Intel tab) shows exactly what was run, what wasn't, and what was blocked
- Every graph edge is clickable — Inspector explains why two entities are connected, its origin (module scan vs correlation vs AI suggestion), and shared evidence sources. AI links are stored as "AI suggestion — UNVERIFIED"
- PDF via browser Print dialog. PNG graph export is included
- crt.sh may need a retry; fallback routes (third-party proxies) and clear messaging are included. Use DNS or Wayback as alternates for subdomains
- Phone live carrier data is context intel, not identity proof; Truecaller/Sync.me/WhatsApp links are investigation pivots you choose to open
- Phone live carrier: 5/min free tier. Offline parse always works

---

### Legal — Localhost Pages

All legal pages live at `localhost` and work offline. No external navigation.

- Privacy: `http://localhost:5173/#privacy`
- Terms: `http://localhost:5173/#terms`
- GDPR: `http://localhost:5173/#gdpr`
- CCPA: `http://localhost:5173/#ccpa`
- Data Compliance: `http://localhost:5173/#data`
- IP Check: `http://localhost:5173/#ip`
- Trademark Check: `http://localhost:5173/#tm`

Click any link in the footer (Privacy · Terms · GDPR · CCPA · Data · IP Check · Trademark) — the URL hash updates and the page opens as a modal. Direct hash access works on reload and after `npm run build`. No social or tracking links are present on the website. The site contains zero outbound social navigation.

### External Links — GitHub Only

The website contains no social links. The following are documented here for contributors and reviewers, not rendered in the app:

- Repository: `https://github.com/indranil122/zero-trace-osint`
- Issues and pull requests: `https://github.com/indranil122/zero-trace-osint/issues`
- Discussions: `https://github.com/indranil122/zero-trace-osint/discussions` (if enabled)
- Live deployments (static `dist/`): Netlify, Vercel, GitHub Pages — see `netlify.toml` and `vercel.json`

Data source endpoints are listed in the Transparency table above. Those are provider APIs contacted only when the operator runs a module, directly from the browser tab. No social platform is contacted by the app itself.

### Legal Notice

Authorized research, CTFs, learning, and self-exposure checks only. Obey the law and each provider's terms. Do not scan without authorization. Do not use breach data to harm. Verify every finding against its primary source before acting.

---

### License

MIT — see `LICENSE`. Free to use, copy, and learn from.
