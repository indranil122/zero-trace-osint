export function parseCdx(rows, domain) {
  const hosts = new Set()
  let snapshots = 0
  if (!Array.isArray(rows)) return { hosts: [], snapshots: 0 }
  const start = Array.isArray(rows[0]) && String(rows[0][0]).includes('original') ? 1 : 0
  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || !row[0]) continue
    try {
      const u = new URL(String(row[0]))
      let host = u.hostname.toLowerCase().replace(/^www\./, '')
      if (host === domain || host.endsWith(`.${domain}`)) hosts.add(host)
      snapshots++
    } catch {
      continue
    }
  }
  return { hosts: [...hosts], snapshots }
}

async function getJson(url, timeoutMs = 20000) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function waybackScan(domain) {
  const findings = []

  let availability = null
  try {
    const a = await getJson(
      `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`
    )
    availability = a?.archived_snapshots?.closest || null
  } catch {}

  if (availability?.url) {
    findings.push({
      kind: '@',
      source: 'Wayback Machine',
      detail: `Closest snapshot of ${domain}: ${availability.timestamp} (${availability.status})`,
      url: availability.url,
    })
  }

  let subs = []
  let snapshotCount = 0
  try {
    const cdx = await getJson(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent('*.' + domain)}&output=json&fl=original,timestamp&collapse=urlkey&limit=3000`
    )
    const parsed = parseCdx(cdx, domain)
    subs = parsed.hosts.filter((h) => h !== domain).sort().slice(0, 120)
    snapshotCount = parsed.snapshots
  } catch {}

  if (!findings.length && !subs.length) {
    throw new Error('Wayback Machine returned nothing useful for this domain')
  }

  if (snapshotCount) {
    findings.push({
      kind: '@',
      source: 'Wayback Machine',
      detail: `${snapshotCount} archived URL(s) crawled under *.${domain}`,
      url: `https://web.archive.org/web/*/${domain}`,
    })
  }

  for (const sub of subs) {
    findings.push({
      kind: 'subdomain',
      value: sub,
      source: 'Wayback Machine',
      detail: 'Hostname seen in archived URLs',
      url: `https://web.archive.org/web/*/${sub}`,
    })
  }

  return findings
}
