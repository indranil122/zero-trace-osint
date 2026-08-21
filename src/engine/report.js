const KIND_ORDER = ['domain', 'subdomain', 'nameserver', 'ip', 'email', 'username', 'account', 'location', 'image', 'phone', 'note']

const KIND_TITLES = {
  domain: 'Domains',
  subdomain: 'Subdomains',
  nameserver: 'Nameservers',
  ip: 'IP Addresses',
  email: 'Emails',
  username: 'Usernames',
  account: 'Accounts',
  location: 'Locations',
  image: 'Images',
  phone: 'Phones',
  note: 'Notes',
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
  const title = isCtf ? `CTF Writeup — ${caseName}` : `OSINT Intelligence Report — ${caseName}`
  L.push(`# ${title}`)
  L.push('')
  L.push(`_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Zero-Trace Workbench (local-only analysis)_`)
  L.push('')

  if (aiNarrative && aiNarrative.trim()) {
    L.push(isCtf ? '## Summary' : '## Executive Summary (AI-assisted)')
    L.push('')
    L.push(aiNarrative.trim())
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
  const statLine = stats.map(([k, arr]) => `${arr.length} ${KIND_TITLES[k].toLowerCase()}`).join(', ')
  L.push(isCtf ? '## Intelligence Gathered' : '## Overview')
  L.push('')
  L.push(`This case contains ${nodes.length} entities (${statLine || 'none'}) connected by ${edges.length} relationships.`)
  L.push('')

  L.push(isCtf ? '## Findings' : '## Entities & Evidence')
  L.push('')
  for (const [kind, arr] of stats) {
    if (!arr.length || kind === 'note') continue
    L.push(`### ${KIND_TITLES[kind]} (${arr.length})`)
    L.push('')
    for (const n of arr) {
      L.push(`- **${n.data.label}**`)
      for (const ev of (n.data.evidence || []).slice(0, 12)) {
        const bits = [`source: ${ev.source}`]
        if (ev.detail) bits.push(ev.detail)
        if (ev.at) bits.push(`at ${fmtTime(ev.at)}`)
        L.push(`  - ${bits.join(' · ')}`)
        if (ev.url) L.push(`    - <${ev.url}>`)
      }
    }
    L.push('')
  }

  const corr = correlationEdges(edges, nodeById)
  if (corr.length) {
    L.push('## Correlated Relationships')
    L.push('')
    for (const c of corr) {
      L.push(`- **${c.a.data.label}** ⇄ **${c.b.data.label}** — ${c.reason}`)
    }
    L.push('')
  }

  const notes = nodes.filter((n) => n.data.kind === 'note' && (n.data.notes || n.data.label))
  if (notes.length) {
    L.push('## Analyst Notes')
    L.push('')
    for (const n of notes) {
      L.push(`- ${n.data.label}${n.data.notes ? ` — ${n.data.notes}` : ''}`)
    }
    L.push('')
  }

  L.push('---')
  L.push(`_${nodes.length} entities · produced offline in-browser. Verify all findings against primary sources before acting on them._`)

  return L.join('\n')
}

export function printHtml(bodyHtml, title) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
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
