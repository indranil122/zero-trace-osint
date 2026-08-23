# Zero-Trace OSINT Workbench

> **Your complete personal investigation workbench — in your browser. No backend or server-side storage — case data and activity logs stay in your browser's IndexedDB, and queries go directly from your browser to public sources. Discover → Correlate → Verify → Check Exposure → Pivot → Report.**

[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind + shadcn](https://img.shields.io/badge/UI-Tailwind_shadcn-black)](https://ui.shadcn.com)
[![License MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![No Backend](https://img.shields.io/badge/Privacy-100%25_Browser_Only-black)](#)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-blue)](public/manifest.webmanifest)

**Live demo:** `npm run dev` → http://localhost:5173 — the app shell and your saved cases stay usable offline after the first load; scans and investigations need network access.

---

### What is this?

Zero-Trace is a free, private tool to investigate domains, usernames, emails, phones, names and images. You type something, it talks directly to public sources and draws everything as a clean graph you can click and explore.

Most tools send your search to *their* server. This one does not. Your search goes straight from your browser to the public source. Nothing is saved on any server — only on your own computer.

**In one sentence:** *Type a domain → see DNS, WHOIS, certificates, archives, breach exposure and links — as dots and lines you can pivot from.*

It now feels like a full workbench: **Discover → Correlate → Verify Evidence → Identify Exposure → Pivot → Report.**

---

### Who is it for?

- **CTF players** — fast recon + one-click report for writeups
- **Students** — learn how real investigations work, visually
- **Researchers** — keep your own trace private while you investigate
- **Anyone checking their own exposure** — see if your email/phone/domain appeared in public breaches, safely

---

### Why it is different

1. **Truly private.** No backend, no database, no logs. All data lives in your browser (IndexedDB). Close the tab, reopen — your case is still there, locally.
2. **You see the graph, not a table.** Every finding becomes a node. A domain connects to its IPs, subdomains, emails, breaches. Drag to link, right-click to run the next check.
3. **Every finding keeps its proof.** Each dot remembers *where* it came from, *when*, TTL, resolver, raw data, and a link to the source. Reports include this evidence.
4. **Smart first, AI second.** Simple rules link things instantly for free (same email on two accounts = linked). AI is only used when you ask it to.

Same core, same privacy — just more complete.

---

### What you can do

| You do | What happens | Example |
|---|---|---|
| **Type a domain → DNS** | Shows A, AAAA, CNAME, MX, TXT… with TTL, resolver, query, time and raw data. A/AAAA IPs are grouped and placed neatly below the domain. | `supermynd.in` → 3 IPs grouped, `TTL 300s via dns.google` |
| **WHOIS / RDAP** | Who owns it, when it was made, registrar | Shows `ns1.dns-parking.com` |
| **Certificates** | Finds hidden subdomains from SSL logs (5-route fallback) | `api.example.com` appears |
| **Wayback** | Finds old pages and subdomains | Archived URLs |
| **Username hunt** | Checks 5 platforms where browser allows | GitHub, GitLab, Reddit, npm, Keybase |
| **Email** | Finds contact emails via RDAP and checks if a Gravatar is associated with the email address hash | `jdoe@example.com` → hash `5d4140…` → avatar? |
| **Email / Phone / Username / Domain / Name** | **Exposure check** — was this in a public breach? | See below |
| **Image drop** | Reads camera, date, GPS **locally** — never uploads. For exposure, we hash the image locally and point you to check the hash yourself. | EXIF stays on device, SHA-256 shown |
| **Correlate** | Links overlap (same IP, same handle, same breach) | `High/Medium` confidence + reason |
| **AI (optional)** | Claude pass for fuzzy matches + summary | Needs your own Anthropic key |

**DNS is now detailed:** Click any domain → Inspector shows record type (A/AAAA…), resolver (`dns.google` vs `cloudflare`), TTL, exact query, timestamp, source URL, and raw → normalized value. Large A/AAAA results are deduplicated and collapsed (show 3 → expand to all), and IPs are placed in a tight cluster — you always know *where and why* it was discovered.

Every edge has a label — for example, `resolves-to`, `has-subdomain`, `delegates-to`, `registrant-contact`, `found-on`/`handle-of`, `hosted-at`, `mentions-email`, `related-to`, `exposed-in`/`affects`, and `correlated`.

---

### Exposure — check your own data, safely

A new **Exposure** module lets you check *your own* email, phone, username, domain, name, or image hash for public breach exposure — through real providers, from your browser.

We never show passwords, tokens, or raw stolen data.

We show: **breach/incident name, date, what was exposed, source, confidence, severity.**

We clearly say which one it is:

- **Confirmed exposure** — provider says this exact value was in a breach
- **Possible match** — name/phone is not unique, or breach affects domain broadly
- **No result** — provider says no known breach for this value
- **Provider unavailable** — CORS/network blocked or needs a key — we tell you how to check manually

**How it works, honestly:**

- **Email** — tries `api.xposedornot.com` (free, works in browser, no key). If blocked and you added a HIBP key in Settings, tries `haveibeenpwned.com` with your key.
- **Domain** — tries `haveibeenpwned.com/api/v3/breaches?domain=` (public). Shows breaches that list this domain.
- **Username / Phone** — requires HIBP BYO key (Settings → HIBP key). Without it, we show `provider unavailable` with guidance — we don’t fake.
- **Image** — we compute `SHA-256` locally in your browser, show the hash, and link to check it yourself on VirusTotal. **Image never leaves your device.**
- Respects CORS and provider limits. No shady proxies. No fake results.

Findings go straight into your graph: `email → exposed-in → Breach` (red `🔓` node), with evidence that includes status, confidence, severity. Next Moves will suggest it, Inspector explains it, and Reports include an **Exposure Intelligence** section.

Add your HIBP key in **Settings → HIBP API key** (stored only in `localStorage`, sent only to `haveibeenpwned.com`).

---

### The canvas — how it feels

- **Graph canvas** — infinite, smooth (Lenis) at your screen’s refresh rate. Drag from a dot’s handle to link.
- **Search** — `Ctrl+K` to jump to any dot.
- **Right-click** — run DNS/WHOIS/Certs/Exposure on that dot.
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Shift+Z` (50 steps).
- **Export image** — one click PNG of the whole graph.
- **Terminal at bottom** — always shows logs + “next steps” (including exposure) suggestions. No hidden panels.

Sidebar is clean: 3 tabs — **Investigate / Build / Intel** — plus a dedicated **Exposure** card (pick kind → type value → Check). All actions fit on screen.

Design: **Apple-like black-on-white** with shadcn/ui, Tailwind. Calm, readable.

---

### Reports — one click

- **Analyst report** — executive summary, overview, entities + detailed DNS evidence, **Exposure Intelligence** (breaches with status/severity/confidence), correlations, notes.
- **CTF writeup** — methodology + findings, ready to submit.
- Download as **.md**, or **Print / Save as PDF** from your browser.

If you add an Anthropic key (Settings), you can generate an AI summary.

---

### Your data stays yours

- Auto-save every 350ms to `IndexedDB` (`zerotrace-workbench`).
- Many cases supported. Last open case remembered.
- Export plain: `.zerotrace.json`
- Export locked: `.ztvault.json` — **AES-256-GCM**, PBKDF2 250,000 rounds, random salt & IV (Web Crypto). No password recovery.
- Import always creates a **new** case — never overwrites.

PWA: install to desktop. Works offline to view saved cases.

---

### Try it in 30 seconds

Need **Node 18+** (built on Node 24).

```bash
npm install
npm run dev      # http://localhost:5173
```

Other commands:

```bash
npm run test     # 33 checks, no browser needed
npm run lint     # oxlint
npm run build    # → dist/  (fully static)
npm run preview  # serve dist/ locally
```

---

### Deploy anywhere — no server needed

`dist/` is just static files. Works on:

- **Netlify** — `netlify.toml` included
- **Vercel** — `vercel.json` included
- **GitHub Pages** — `base: './'` already set

Just drag `dist/` or `npm run build` on the host.

---

### How it is built (simple)

```
src/
  api/        talks to public sources (dns with TTL/resolver, rdap, crtsh, wayback, username, exif, gravatar, exposure via XposedOrNot/HIBP, ai)
  engine/     plain logic: linking rules (incl. exposed-in), next-step suggestions (incl. exposure), timeline, reports (incl. Exposure Intelligence)
  store/      one Zustand store + IndexedDB (cases, incl. breach nodes, 50-step undo)
  workers/    crt.sh parsing off the main thread
  components/ UI — sidebar (with Exposure), canvas (grouped DNS), inspector (detailed DNS + breach), terminal, modals
  utils/      kinds (domain… breach… name…), crypto (vault), md5
```

A node is `kind:value` (like `domain:example.com` or `breach:Collection #1`) so the same thing never duplicates. Graph, storage, and privacy design are unchanged — just more capable.

---

### Honest limits

- Username check = **5 platforms** (browser CORS limit; more needs a tiny proxy — planned)
- **Exposure**: Email works without a key (XposedOrNot). Username/Phone/Domain via HIBP need your BYO HIBP key — otherwise we show `provider unavailable` and tell you where to check manually. We never fake.
- PDF is via your browser’s Print dialog (lightweight)
- If `crt.sh` is blocked, we try 5 routes + show a clear message — try **DNS** or **Wayback** for subdomains instead

Details: `docs/GAP-ANALYSIS.md` → `docs/ROADMAP.md`.

---

### Is it legal?

For **authorized research, CTFs, learning, and checking your own exposure only**. You must follow the law and each source’s terms. Don’t scan what you don’t have permission to investigate. Never use breach data to harm.

---

### Tags / Keywords

`osint` `recon` `osint-tool` `ctf` `security` `investigation` `graph` `browser-only` `privacy` `no-backend` `pwa` `react` `vite` `tailwindcss` `shadcn-ui` `lenis` `indexeddb` `certificate-transparency` `whois` `dns` `dns-investigation` `ttl` `wayback-machine` `exif` `breach` `exposure` `haveibeenpwned` `xposedornot` `personal-osint`

Add these as **GitHub Topics** (Repo → Settings → Topics) to help people find it.

---

### License

**MIT** — see [LICENSE](LICENSE). Free to use, copy, and learn from.
