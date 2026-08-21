function vcardName(entity) {
  const rows = entity?.vcardArray?.[1]
  if (!Array.isArray(rows)) return null
  const fn = rows.find((x) => Array.isArray(x) && x[0] === 'fn')
  return fn && typeof fn[3] === 'string' && fn[3].trim() ? fn[3].trim() : null
}

const EVENT_LABELS = {
  registration: 'Registered',
  expiration: 'Expires',
  'last changed': 'Last changed',
  transfer: 'Transferred',
  'registrar expiration': 'Expires',
}

export async function rdapScan(domain) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 20000)
  let j
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json' },
      redirect: 'follow',
      signal: ctl.signal,
    })
    if (r.status === 404) throw new Error('No RDAP record for this domain')
    if (r.status === 429) throw new Error('RDAP rate-limited — try again in a moment')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    j = await r.json()
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('RDAP timed out')
    if (e.message.startsWith('No RDAP') || e.message.startsWith('RDAP')) throw e
    throw new Error(`RDAP lookup blocked or unreachable (${e.message})`)
  } finally {
    clearTimeout(timer)
  }

  const link = `https://rdap.org/domain/${encodeURIComponent(domain)}`
  const findings = []

  for (const ev of j.events || []) {
    const label = EVENT_LABELS[ev.eventAction] ?? ev.eventAction
    if (!label || !ev.eventDate) continue
    findings.push({
      kind: '@',
      source: 'WHOIS · RDAP',
      detail: `${label}: ${String(ev.eventDate).slice(0, 10)}`,
      url: link,
    })
  }

  for (const st of (j.status || []).slice(0, 8)) {
    findings.push({ kind: '@', source: 'WHOIS · RDAP', detail: `Status: ${st}`, url: link })
  }

  const registrar = (j.entities || []).find((e) => (e.roles || []).includes('registrar'))
  if (registrar) {
    const name = vcardName(registrar)
    if (name) {
      findings.push({ kind: '@', source: 'WHOIS · RDAP', detail: `Registrar: ${name}`, url: link })
    }
  }

  const emails = new Set(
    String(JSON.stringify(j.entities || [])).match(
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
    ) || []
  )
  ;[...emails]
    .map((m) => m.toLowerCase())
    .filter((m) => !m.endsWith('.somedomain.example'))
    .slice(0, 8)
    .forEach((m) =>
      findings.push({
        kind: 'email',
        value: m,
        source: 'WHOIS · RDAP',
        detail: 'Contact email found in registration record',
        url: link,
      })
    )

  for (const ns of j.nameservers || []) {
    if (ns.ldhName) {
      findings.push({
        kind: 'nameserver',
        value: ns.ldhName.toLowerCase(),
        source: 'WHOIS · RDAP',
        detail: 'Nameserver from registry record',
        url: link,
      })
    }
  }

  if (!findings.length) throw new Error('RDAP returned no usable data')
  return findings
}
