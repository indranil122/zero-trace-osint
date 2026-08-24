import { overallScore } from './scoring.js'
import { computeCoverage, coverageSentence } from './coverage.js'

const KIND_ORDER = ['domain', 'subdomain', 'nameserver', 'ip', 'email', 'username', 'account', 'breach', 'risk', 'collection', 'name', 'location', 'image', 'phone', 'note']

const KIND_TITLES = {
  domain: 'Domains',
  subdomain: 'Subdomains',
  nameserver: 'Nameservers',
  ip: 'IP Addresses',
  email: 'Emails',
  username: 'Usernames',
  account: 'Accounts',
  breach: 'Breaches',
  risk: 'Risk Profiles',
  collection: 'Collections',
  name: 'Names',
  location: 'Locations',
  image: 'Images',
  phone: 'Phones',
  note: 'Notes',
}

function escMd(s) {
  const inline = String(s || '').replace(/[*_`[\\<]/g, '\\$&')
  return inline
    .split('\n')
    .map((line) =>
      line
        .replace(/^(\s*)(#{1,6})(\s)/, (_, a, b, c) => `${a}\\${b[0]}${b.slice(1)}${c}`)
        .replace(/^(\s*)>/, '$1\\>')
        .replace(/^(\s*)([-*+])(\s)/, '$1\\$2$3')
        .replace(/^(\s*)(\d+)(\.)(\s)/, '$1$2\\$3$4')
        .replace(/^(\s*)([-*_])(\s*\2){2,}\s*$/, (m) => `\\${m.trim()[0]}${m.trim().slice(1)}`)
    )
    .join('\n')
}
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

function correlationEdges(edges, nodeById) {
  return edges
    .filter((e) => e.data?.correlation)
    .map((e) => ({
      a: nodeById.get(e.source),
      b: nodeById.get(e.target),
      reason: e.data.reason || '',
    }))
    .filter((x) => x.a && x.b)
}

export function buildReport({ caseName, nodes, edges, log, aiNarrative }, mode = 'analyst') {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const byKind = new Map()
  for (const k of KIND_ORDER) byKind.set(k, [])
  for (const n of nodes) {
    if (!byKind.has(n.data.kind)) byKind.set(n.data.kind, [])
    byKind.get(n.data.kind).push(n)
  }

  const L = []
  const isCtf = mode === 'ctf'
  const safeName = escMd(caseName || 'Untitled')
  const title = isCtf ? `CTF Writeup — ${safeName}` : `OSINT Intelligence Report — ${safeName}`
  L.push(`# ${title}`)
  L.push('')
  L.push(`_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · VeilTrace Workbench (local-only analysis)_`)
  L.push('')

  if (aiNarrative && aiNarrative.trim()) {
    L.push(isCtf ? '## Summary' : '## Executive Summary (AI-assisted)')
    L.push('')
    L.push(escMd(aiNarrative.trim()))
    L.push('')
  }

  if (isCtf) {
    const steps = log.filter((l) => l.level === 'ok' || l.text.startsWith('Running'))
    L.push('## Methodology')
    L.push('')
    if (steps.length) {
      steps.slice(0, 40).forEach((s, i) => L.push(`${i + 1}. ${s.text.replace(/^[✓·?]|done — .*$/g, '').trim()}`))
    } else {
      L.push('_No module runs recorded._')
    }
    L.push('')
  }

  const stats = [...byKind.entries()].filter(([, arr]) => arr.length)
  const statLine = stats.map(([k, arr]) => `${arr.length} ${(KIND_TITLES[k] || k).toLowerCase()}`).join(', ')
  L.push(isCtf ? '## Intelligence Gathered' : '## Overview')
  L.push('')
  L.push(`This case contains ${nodes.length} entities (${statLine || 'none'}) connected by ${edges.length} relationships.`)
  L.push('')
  try {
    const { score, label } = overallScore(nodes)
    if (score > 0 || nodes.some((n) => n.data.kind === 'breach')) {
      L.push('## Risk Score')
      L.push('')
      L.push(`**${score}/100 — ${label.toUpperCase()}**`)
      L.push('')
    }
  } catch {}

  // Investigation Coverage + negative evidence + unavailable sources
  try {
    const cov = computeCoverage(nodes)
    const word = { checked: 'Checked', unavailable: 'UNAVAILABLE', manual: 'Manual only', 'not-run': 'Not run' }
    L.push('## Investigation Coverage')
    L.push('')
    L.push(coverageSentence(cov))
    L.push('')
    for (const r of cov.rows) {
      L.push(`- **${r.label}** — ${word[r.status] || r.status}${r.detail ? ` — ${escMd(r.detail)}` : ''}`)
    }
    const unavail = cov.rows.filter((r) => r.status === 'unavailable')
    if (unavail.length) {
      L.push('')
      L.push('_Unavailable sources mean the case is INCOMPLETE. Absence of findings from an unavailable source is not evidence of absence._')
    }
    if (cov.summary.negativeEvidence.length) {
      L.push('')
      L.push('### Negative evidence (checked, not found)')
      L.push('')
      for (const n of cov.summary.negativeEvidence) {
        L.push(`- ${n.handles.map(escMd).join(', ')} — no account on **${n.platform}**`)
      }
    }
    L.push('')
  } catch {}

  L.push(isCtf ? '## Findings' : '## Entities & Evidence')
  L.push('')
  for (const [kind, arr] of stats) {
    if (!arr.length || kind === 'note') continue
    L.push(`### ${(KIND_TITLES[kind] || kind)} (${arr.length})`)
    L.push('')
    for (const n of arr) {
      L.push(`- **${escMd(n.data.label)}**`)
      for (const ev of (n.data.evidence || []).slice(0, 12)) {
        const bits = [`source: ${escMd(ev.source)}`]
        if (ev.detail) bits.push(escMd(ev.detail))
        if (ev.at) bits.push(`at ${fmtTime(ev.at)}`)
        L.push(`  - ${bits.join(' · ')}`)
        if (ev.url) L.push(`    - <${escMd(ev.url)}>`)
      }
    }
    L.push('')
  }

  // Exposure Intelligence — Discover → Correlate → Verify → Exposure → Report
  const exposureNodes = byKind.get('breach') || []
  const exposureEvs = nodes.flatMap((n) => (n.data.evidence || []).filter((ev) => ev.source && ev.source.includes('Exposure')))
  if (exposureNodes.length || exposureEvs.length) {
    L.push('## Exposure Intelligence')
    L.push('')
    if (exposureNodes.length) {
      L.push(`Confirmed breach references: ${exposureNodes.map((n) => escMd(n.data.label)).join(', ')}`)
      L.push('')
    }
    const byStatus = {}
    for (const ev of exposureEvs) {
      const s = ev.status || (ev.meta && ev.meta.status) || 'unknown'
      byStatus[s] = (byStatus[s] || 0) + 1
    }
    if (Object.keys(byStatus).length) {
      L.push(`Exposure summary: ${Object.entries(byStatus).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ')}`)
      L.push('')
    }
    for (const n of nodes) {
      for (const ev of (n.data.evidence || []).filter((ev) => ev.source && ev.source.includes('Exposure'))) {
        const status = ev.status || (ev.meta && ev.meta.status) || 'unknown'
        const sev = ev.severity || (ev.meta && ev.meta.severity) || ''
        const conf = ev.confidence || (ev.meta && ev.meta.confidence) || ''
        const bName = ev.breachName || (ev.meta && ev.meta.breachName) || ''
        const bDate = ev.breachDate || (ev.meta && ev.meta.breachDate) || ''
        const dClasses = ev.dataClasses || (ev.meta && ev.meta.dataClasses) || ''
        let line = `- **${escMd(n.data.label)}** (${n.data.kind}) — **${escMd(status)}** — ${escMd(ev.detail)}`
        if (bName) line += ` — breach: ${escMd(bName)}`
        if (bDate) line += ` @ ${escMd(String(bDate).slice(0, 10))}`
        if (dClasses) line += ` — data: ${escMd(String(dClasses).slice(0, 80))}`
        if (conf) line += ` — confidence: ${escMd(conf)}`
        if (sev) line += ` — severity: ${escMd(sev)}`
        line += ` — source: ${escMd(ev.source)}`
        L.push(line)
        if (ev.url) L.push(`  - <${escMd(ev.url)}>`)
      }
    }
    L.push('')
    L.push('_Never displays passwords/tokens/cookies. Statuses: confirmed exposure, possible match, no result, provider unavailable. Verify via original breach source._')
    L.push('')
  }

  const corr = correlationEdges(edges, nodeById)
  if (corr.length) {
    L.push('## Correlated Relationships')
    L.push('')
    for (const c of corr) {
      L.push(`- **${escMd(c.a.data.label)}** ⇄ **${escMd(c.b.data.label)}** — ${escMd(c.reason)}`)
    }
    L.push('')
  }

  const notes = nodes.filter((n) => n.data.kind === 'note' && (n.data.notes || n.data.label))
  if (notes.length) {
    L.push('## Analyst Notes')
    L.push('')
    for (const n of notes) {
      L.push(`- ${escMd(n.data.label)}${n.data.notes ? ` — ${escMd(n.data.notes)}` : ''}`)
    }
    L.push('')
  }

  L.push('---')
  L.push(`_${nodes.length} entities · produced offline in-browser. Verify all findings against primary sources before acting on them._`)

  return L.join('\n')
}

export function buildAbuseReport({ caseName, nodes, edges: _edges }) {
  const domains = nodes.filter((n) => n.data.kind === 'domain' || n.data.kind === 'subdomain')
  const ips = nodes.filter((n) => n.data.kind === 'ip')
  const emails = nodes.filter((n) => n.data.kind === 'email')
  const L = []
  L.push(`# Abuse Report — ${escMd(caseName || 'Untitled')}`)
  L.push('')
  L.push(`_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · VeilTrace Workbench_`)
  L.push('')
  L.push('> **For authorized abuse reporting only.** Verify all indicators against primary sources before sending. Include your contact details before submitting to the abuse contact.')
  L.push('')
  if (!domains.length && !ips.length) {
    L.push('_No domain/IP indicators in this case — add DNS/WHOIS findings first._')
    L.push('')
  }
  if (domains.length) {
    L.push('## Indicators — Domains')
    L.push('')
    for (const d of domains) {
      const ev = (d.data.evidence || []).map((e) => `${e.source}: ${e.detail}`).slice(0, 3).join(' · ')
      L.push(`- **${escMd(d.data.label)}**${ev ? ` — ${escMd(ev)}` : ''}`)
    }
    L.push('')
  }
  if (ips.length) {
    L.push('## Indicators — IPs')
    L.push('')
    for (const ip of ips) {
      const ev = (ip.data.evidence || []).map((e) => `${e.source}: ${e.detail}`).slice(0, 3).join(' · ')
      L.push(`- **${escMd(ip.data.label)}**${ev ? ` — ${escMd(ev)}` : ''}`)
    }
    L.push('')
  }
  // RDAP abuse contacts if present in evidence
  const rdapEmails = [...new Set(
    nodes.flatMap((n) => (n.data.evidence || []).filter((e) => e.source && e.source.includes('RDAP')).flatMap(() => emails.map((em) => em.data.label)))
  )]
  if (rdapEmails.length || emails.length) {
    L.push('## Contacts gathered (verify via RDAP)')
    L.push('')
    for (const em of emails.slice(0, 8)) {
      L.push(`- ${escMd(em.data.label)}`)
    }
    if (!emails.length && rdapEmails.length) {
      for (const em of rdapEmails.slice(0, 8)) L.push(`- ${escMd(em)}`)
    }
    L.push('')
  }
  L.push('## Recommended abuse contacts (lookup via RDAP)')
  L.push('')
  L.push('- Domain registrar abuse contact: `rdap.org/domain/<domain>` → `entities` with role `abuse` → `vcardArray` email')
  L.push('- IP net abuse contact: `rdap.db.ripe.net` / `rdap.arin.net` for ASN')
  L.push('')
  L.push('## Draft email template')
  L.push('')
  L.push('```')
  L.push(`Subject: Abuse report — ${caseName || 'OSINT findings'} — please investigate`)
  L.push('')
  L.push('Hello Abuse Team,')
  L.push('')
  L.push('I am reporting the following indicators observed during an authorized investigation. Please investigate per your AUP:')
  if (domains.length) L.push(`Domains: ${domains.map((d) => d.data.label).join(', ')}`)
  if (ips.length) L.push(`IPs: ${ips.map((i) => i.data.label).join(', ')}`)
  L.push('')
  L.push('Evidence (with timestamps and sources) is attached as Markdown/PDF from the case export. Key evidence:')
  for (const n of [...domains, ...ips].slice(0, 6)) {
    for (const ev of (n.data.evidence || []).slice(0, 2)) {
      L.push(`- ${n.data.label}: ${ev.source} — ${ev.detail} @ ${fmtTime(ev.at)} ${ev.url ? `<${ev.url}>` : ''}`)
    }
  }
  L.push('')
  L.push('Reporter contact: [Your name, org, email, phone]')
  L.push('Authorization: [Brief statement of authorization / CTF scope]')
  L.push('')
  L.push('Thank you,')
  L.push('```')
  L.push('')
  L.push('---')
  L.push('_Generated locally. Do not send without verifying indicators and adding your contact._')
  return L.join('\n')
}

export function printHtml(bodyHtml, title) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1a2233;line-height:1.55;font-size:14px}
  h1{font-size:26px;border-bottom:2px solid #1a2233;padding-bottom:8px}
  h2{font-size:19px;margin-top:28px}
  h3{font-size:15px;color:#334}
  code,pre{font-family:Consolas,monospace;font-size:12px;background:#f3f5f9;padding:1px 4px;border-radius:3px}
  blockquote{border-left:3px solid #ccd;margin-left:0;padding-left:14px;color:#556}
  table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;font-size:12px}
  hr{border:none;border-top:1px solid #ddd;margin-top:32px}
  em{color:#556}
</style></head><body>${bodyHtml}<script>window.onload=()=>{setTimeout(()=>window.print(),250)}${'</scr' + 'ipt>'}</body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  iframe.srcdoc = html
  setTimeout(() => iframe.remove(), 60000)
}
