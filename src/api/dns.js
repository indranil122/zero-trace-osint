const RESOLVERS = ['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query']

async function dohQuery(name, type) {
  let lastErr
  for (const base of RESOLVERS) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 10000)
    try {
      const r = await fetch(`${base}?name=${encodeURIComponent(name)}&type=${type}`, {
        headers: { accept: 'application/dns-json' },
        signal: ctl.signal,
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      return { json, resolver: base.includes('google') ? 'dns.google' : 'cloudflare-dns.com' }
    } catch (e) {
      lastErr = e
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr || new Error('All resolvers failed')
}

export async function dnsScan(domain) {
  const types = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA']
  const findings = []
  const now = Date.now()
  const normalizedDomain = String(domain || '').trim().toLowerCase()

  for (const type of types) {
    try {
      const { json: j, resolver } = await dohQuery(normalizedDomain, type)
      const rawAnswers = j.Answer || []
      if (!rawAnswers.length) continue
      const link = `https://dns.google/query?name=${encodeURIComponent(normalizedDomain)}&type=${type}`
      const ttl = rawAnswers[0]?.TTL ?? j.TTL ?? null
      const answers = rawAnswers.map((a) => String(a.data))

      if (type === 'A' || type === 'AAAA') {
        const expectedType = type === 'A' ? 1 : 28
        for (const ans of rawAnswers) {
          if (ans.type !== expectedType) continue
          const ip = String(ans.data).trim()
          if (!ip) continue
          findings.push({
            kind: 'ip',
            value: ip,
            source: 'DNS-over-HTTPS',
            detail: `${type} ${ip} ← ${normalizedDomain} (TTL ${ans.TTL ?? ttl ?? '—'}s via ${resolver})`,
            url: link,
            meta: {
              recordType: type,
              ttl: ans.TTL ?? ttl ?? null,
              resolver,
              query: normalizedDomain,
              raw: ans.data,
              normalized: ip,
              timestamp: now,
              sourceUrl: link,
            },
          })
        }
      }

      // Detailed aggregate evidence for Inspector — includes TTL, resolver, raw
      findings.push({
        kind: '@',
        source: 'DNS-over-HTTPS',
        detail: `${type} ×${answers.length} — TTL ${ttl ?? '—'}s via ${resolver} @ ${new Date(now).toISOString().slice(0, 19)}Z`,
        url: link,
        meta: {
          recordType: type,
          ttl,
          resolver,
          query: normalizedDomain,
          raw: answers,
          normalized: answers,
          count: answers.length,
          timestamp: now,
          sourceUrl: link,
        },
      })
    } catch {
      continue
    }
  }

  if (!findings.length) {
    throw new Error('No DNS records returned (domain may not resolve)')
  }
  return findings
}
