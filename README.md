# Zero-Trace OSINT Workbench

> **Investigate anything — right in your browser. No server, no account, no logs.**

[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind + shadcn](https://img.shields.io/badge/UI-Tailwind_shadcn-black)](https://ui.shadcn.com)
[![License MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![No Backend](https://img.shields.io/badge/Privacy-100%25_Browser_Only-black)](#)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-blue)](public/manifest.webmanifest)

**Live demo:** `npm run dev` → http://localhost:5173 — works fully offline after first load.

---

### What is this?

Zero-Trace is a free tool to investigate domains, usernames, emails and images. You type a name, it talks directly to public sources and draws everything as a clean graph you can click and explore.

Most OSINT tools send your search to *their* server. This one does not. Your search goes straight from your browser to the public source. Nothing is saved on any server — only on your own computer.

**In one sentence:** *Type a domain → see DNS, WHOIS, certificates, archives, and links — as dots and lines you can pivot from.*

---

### Who is it for?

- **CTF players** — fast recon + one-click report for writeups
- **Students** — learn how real investigations work, visually
- **Researchers** — keep your own trace private while you investigate

---

### Why it is different

1. **Truly private.** No backend, no database, no logs. All data lives in your browser (IndexedDB). Close the tab, reopen — your case is still there, locally.
2. **You see the graph, not a table.** Every finding becomes a node. A domain connects to its IPs, subdomains, emails. Drag to link, right-click to run the next check.
3. **Every finding keeps its proof.** Each dot remembers *where* it came from, *when*, and a link to the source. Reports include this evidence.
4. **Smart first, AI second.** Simple rules link things instantly for free (same email on two accounts = linked). AI is only used when you ask it to.

---

### What you can do

| You do | What happens | Example |
|---|---|---|
| **Type a domain → DNS** | Shows A, MX, TXT, NS… records | `supermynd.in` → IPs, mail servers |
| **WHOIS / RDAP** | Who owns it, when it was made, registrar | Shows `ns1.dns-parking.com` |
| **Certificates** | Finds hidden subdomains from SSL logs | `api.example.com` appears |
| **Wayback** | Finds old pages and subdomains | Archived URLs |
| **Username hunt** | Checks 5 platforms where CORS allows | GitHub, GitLab, Reddit, npm, Keybase |
| **Email** | Finds contacts + Gravatar check | Is `jdoe@example.com` real/active? |
| **Image drop** | Reads camera, date, GPS — never uploads | EXIF stays on your device |
| **Correlate** | Links overlap (same IP, same handle) | High/Medium confidence + reason |
| **AI** | Optional Claude pass for fuzzy matches | Needs your own Anthropic key |

Every edge on the graph has a label: `resolves-to`, `subdomain-of`, `delegates-to`, `correlated`.

---

### The canvas — how it feels

- **Graph canvas** — infinite, smooth (Lenis) at your screen’s refresh rate. Drag from a dot’s handle to link.
- **Search** — `Ctrl+K` to jump to any dot.
- **Right-click** — run DNS/WHOIS/Certs on that dot.
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Shift+Z` (50 steps).
- **Export image** — one click PNG of the whole graph.
- **Terminal at bottom** — always shows logs + “next steps” suggestions. No hidden panels.

Sidebar is now clean: 3 tabs — **Investigate / Build / Intel** — so nothing scrolls. All actions fit on screen.

Design: **Apple-like black-on-white** with shadcn/ui, Tailwind. Looks calm, reads easy.

---

### Reports — one click

- **Analyst report** — executive summary, overview, entities + evidence, correlations, notes.
- **CTF writeup** — methodology + findings, ready to submit.
- Download as **.md**, or **Print / Save as PDF** from your browser.

If you add an Anthropic key (Settings → saved only in `localStorage`), you can generate an AI summary.

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
npm run test     # 27 checks, no browser needed
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
  api/        talks to public sources (dns, rdap, crtsh, wayback, username, exif, gravatar, ai)
  engine/     plain logic: linking rules, next-step suggestions, timeline, reports
  store/      one Zustand store + IndexedDB (cases live here)
  workers/    crt.sh parsing off the main thread
  components/ UI — sidebar, canvas, inspector, terminal, modals
  utils/      kinds (what is a domain/email…), crypto (vault), md5
```

A node is `kind:value` (like `domain:example.com`) so the same thing never duplicates.

---

### Honest limits

- Username check = **5 platforms** (browser CORS limit; more needs a tiny proxy — planned)
- No breach-data lookup yet (HIBP needs a paid key — BYO design is ready)
- PDF is via your browser’s Print dialog (lightweight, no extra 350KB)
- If `crt.sh` is blocked, we try 5 routes + show a clear message — try **DNS** or **Wayback** for subdomains instead

Details: `docs/GAP-ANALYSIS.md` → `docs/ROADMAP.md`.

---

### Is it legal?

For **authorized research, CTFs, and learning only**. You must follow the law and each source’s terms. Don’t scan what you don’t have permission to investigate.

---

### Tags / Keywords

`osint` `recon` `osint-tool` `ctf` `security` `investigation` `graph` `browser-only` `privacy` `no-backend` `pwa` `react` `vite` `tailwindcss` `shadcn-ui` `lenis` `indexeddb` `certificate-transparency` `whois` `dns` `wayback-machine` `exif`

Add these as **GitHub Topics** (Repo → Settings → Topics) to help people find it.

---

### License

**MIT** — see [LICENSE](LICENSE). Free to use, copy, and learn from.
