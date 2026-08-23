export const privacyContent = {
  title: 'Privacy Policy',
  updated: '23 August 2026',
  intro: 'Zero-Trace is a browser-only workbench. There is no backend, no account database, and no server log of your investigations.',
  sections: [
    {
      h: '1. What we store',
      p: 'Everything lives in this browser’s IndexedDB (zerotrace-workbench) and optional localStorage for theme + API keys. We never transmit case files, nodes, or log entries to any Zero-Trace server — because none exists. Export creates a JSON file on your device; Vault encrypts it locally with AES-256-GCM (PBKDF2 250k). You can delete all data via Clear site data.',
    },
    {
      h: '2. What leaves your device',
      p: 'Only when you run a module: your query goes directly from this tab to the public source (e.g. dns.google, rdap.org, crt.sh, ip-api.com, Gravatar). We proxy nothing. Each request is visible in DevTools → Network. If you paste an API key (Anthropic/HIBP), it is stored in localStorage and sent only to that vendor.',
    },
    {
      h: '3. Cookies & analytics',
      p: 'No cookies. No analytics. No fingerprinting. No third-party scripts beyond the sources you explicitly query.',
    },
    {
      h: '4. Your rights',
      p: 'Access, correct, export, or erase your data at any time: use Export .json / Vault or clear site storage. For questions contact the maintainer listed in the repository.',
    },
  ],
}

export const termsContent = {
  title: 'Terms of Service',
  updated: '23 August 2026',
  sections: [
    {
      h: '1. Authorized use only',
      p: 'For authorized research, CTFs, coursework, and checking your own exposure only. You must have permission to investigate every domain, IP, and identity you query. Do not use breach data to harm, dox, or harass.',
    },
    {
      h: '2. No warranty',
      p: 'Provided AS IS under MIT License. We do not guarantee accuracy of DNS, RDAP, crt.sh, or third-party APIs. Correlate and verify before acting.',
    },
    {
      h: '3. Your responsibility',
      p: 'You are responsible for complying with each data source’s terms (e.g. crt.sh, RDAP, ip-api.com) and applicable laws (CFAA, ECPA, GDPR, etc.). Abuse or rate-limit evasion is prohibited.',
    },
    {
      h: '4. Limitation of liability',
      p: 'To the fullest extent permitted by law, maintainers are not liable for any damages arising from use of this tool.',
    },
    {
      h: '5. Changes',
      p: 'These terms may be updated with notice in the repository changelog. Continued use constitutes acceptance.',
    },
  ],
}

export const gdprContent = {
  title: 'GDPR Compliance',
  updated: '23 August 2026',
  sections: [
    {
      h: 'Scope',
      p: 'Zero-Trace processes no personal data on a server. As a data controller, you process personal data locally in your browser when you enter it. This page explains how the tool supports your GDPR obligations.',
    },
    {
      h: 'Legal bases (Art. 6)',
      p: 'You determine the legal basis: consent (checking your own mailbox with your consent), legitimate interest (authorized security research with DPIA), or contract. The tool does not set a basis for you.',
    },
    {
      h: 'Data subject rights',
      p: 'Rights to access, rectification, erasure, restriction, portability, and objection are exercised directly: you can view, edit, export, or delete any node/evidence in the Inspector or clear IndexedDB. No request to a data processor is needed.',
    },
    {
      h: 'Retention & minimization',
      p: 'Retention is user-controlled. Cases persist until you delete them. Evidence stores only the minimal source snippet + timestamp to prove provenance. Vault at-rest encryption satisfies Art. 32.',
    },
    {
      h: 'Cross-border transfers',
      p: 'Queries go to public sources you choose. If a source is outside the EEA, you are the transferor — assess adequacy/SCCs per source.',
    },
  ],
}

export const ccpaContent = {
  title: 'CCPA / CPRA Notice',
  updated: '23 August 2026',
  sections: [
    {
      h: 'No sale or sharing',
      p: 'We do not sell, share, or profile personal information. There is no backend to sell data from. Queries to public sources are sent by you; we receive nothing.',
    },
    {
      h: 'Your rights (Cal. Civ. Code §1798.100 et seq.)',
      p: 'Right to know, delete, correct, and non-discrimination. Exercise by inspecting this browser’s storage (Application → IndexedDB) or exporting/deleting cases. No verification step is required because data never leaves the device.',
    },
    {
      h: 'Authorized agent & metrics',
      p: 'No authorized-agent workflow is needed. We publish no annual metrics because we collect none.',
    },
  ],
}

export const dataComplianceContent = {
  title: 'Data Compliance',
  updated: '23 August 2026',
  sections: [
    {
      h: 'Sub-processors',
      p: 'None. This is a static frontend (dist/ may be hosted on Netlify/Vercel/GitHub Pages). Those hosts see only standard CDN logs; they do not receive case content.',
    },
    {
      h: 'Encryption',
      p: 'In transit: TLS to each public source. At rest (optional Vault): AES-256-GCM, PBKDF2-HMAC-SHA256 250,000 iterations, random 16-byte salt + 12-byte IV via Web Crypto.',
    },
    {
      h: 'Breach notification',
      p: 'No server breach surface. If your device is compromised, rotate any pasted API keys (Anthropic/HIBP) and re-export Vaults with a new password.',
    },
    {
      h: 'Auditability',
      p: 'Every finding keeps an evidence item (source, timestamp, raw snippet, URL) shown in the Inspector and included in exported reports for reproducibility.',
    },
  ],
}
