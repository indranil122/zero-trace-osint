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
      return await r.json()
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

  for (const type of types) {
    try {
      const j = await dohQuery(domain, type)
      const answers = (j.Answer || []).map((a) => String(a.data))
      if (!answers.length) continue
      const link = `https://dns.google/query?name=${encodeURIComponent(domain)}&type=${type}`
      if (type === 'A' || type === 'AAAA') {
        for (const ip of answers) {
          findings.push({
            kind: 'ip',
            value: ip,
            source: 'DNS-over-HTTPS',
            detail: `${type} record resolving ${domain}`,
            url: link,
          })
        }
      }
      findings.push({
        kind: '@',
        source: 'DNS-over-HTTPS',
        detail: `${type} ×${answers.length}: ${answers.slice(0, 5).join(', ')}${answers.length > 5 ? ' …' : ''}`,
        url: link,
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
