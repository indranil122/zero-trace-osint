// Browser-only Google/Bing dork generator — no API key, no network.
// Inspired by OpenOSINT `generate_dorks` + theHarvester enumeration patterns.
export function buildDorks({ kind, value }) {
  const v = String(value || '').trim()
  if (!v) return []
  const q = encodeURIComponent
  const dorks = []

  const google = (query, label, note) => ({
    name: label,
    url: `https://www.google.com/search?q=${q(query)}`,
    note,
    engine: 'google',
  })
  const bing = (query, label) => ({
    name: `${label} · Bing`,
    url: `https://www.bing.com/search?q=${q(query)}`,
    note: 'Second index',
    engine: 'bing',
  })
  const ddg = (query, label) => ({
    name: `${label} · DDG`,
    url: `https://duckduckgo.com/?q=${q(query)}`,
    note: 'Privacy engine',
    engine: 'ddg',
  })

  if (kind === 'domain' || kind === 'subdomain') {
    const d = v.toLowerCase()
    dorks.push(
      google(`site:${d}`, 'Site crawl', 'All indexed pages under domain'),
      google(`site:*.${d}`, 'Subdomains', 'Wildcard subdomain discovery'),
      google(`"${d}"`, 'Exact mentions', 'Mentions across web'),
      google(`site:github.com "${d}"`, 'GitHub mentions', 'Code/config leaks'),
      google(`site:pastebin.com "${d}"`, 'Paste mentions', 'Pastes/dumps'),
      google(`site:linkedin.com "${d}"`, 'LinkedIn', 'Org people/roles'),
      bing(`site:${d}`, 'Site · Bing'),
      ddg(`site:${d}`, 'Site · DDG')
    )
  } else if (kind === 'email') {
    const [user, domain] = v.split('@')
    dorks.push(
      google(`"${v}"`, 'Exact email', 'Direct mentions'),
      google(`"${v}" site:pastebin.com OR site:ghostbin.co OR site:hastebin.com`, 'Pastes', 'Dump sites'),
      google(`"${domain}" "${user}"`, 'User+domain', 'Obfuscated mentions'),
      google(`site:github.com "${v}"`, 'GitHub', 'Commits/config leaks'),
      bing(`"${v}"`, 'Exact · Bing'),
      ddg(`"${v}"`, 'Exact · DDG')
    )
    if (domain) {
      dorks.push(google(`site:${domain} "${user}"`, 'Domain user', 'Other users on same domain'))
    }
  } else if (kind === 'username') {
    const h = v.replace(/^@+/, '')
    dorks.push(
      google(`"${h}"`, 'Exact handle', 'Handle mentions'),
      google(`site:github.com "${h}"`, 'GitHub', 'Code/profile'),
      google(`site:twitter.com OR site:x.com "${h}"`, 'X/Twitter', 'Social'),
      google(`site:linkedin.com/in "${h}"`, 'LinkedIn', 'Professional'),
      google(`"${h}" site:pastebin.com`, 'Pastes', 'Leaks'),
      bing(`"${h}"`, 'Handle · Bing'),
      ddg(`"${h}"`, 'Handle · DDG')
    )
  } else if (kind === 'phone') {
    const fmts = String(v).trim()
    dorks.push(
      google(`"${fmts}"`, 'Exact phone', 'Phone mentions'),
      google(`"${fmts}" site:facebook.com OR site:twitter.com`, 'Social', 'Posts mentioning number'),
      google(`"${fmts}" site:pastebin.com`, 'Pastes', 'Leaks'),
      bing(`"${fmts}"`, 'Phone · Bing'),
      ddg(`"${fmts}"`, 'Phone · DDG')
    )
  } else if (kind === 'name') {
    const name = v
    dorks.push(
      google(`"${name}"`, 'Exact name', 'Name mentions'),
      google(`"${name}" site:linkedin.com`, 'LinkedIn', 'Professional profile'),
      google(`"${name}" site:github.com`, 'GitHub', 'Code'),
      bing(`"${name}"`, 'Name · Bing'),
      ddg(`"${name}"`, 'Name · DDG')
    )
  } else if (kind === 'ip') {
    dorks.push(
      google(`"${v}"`, 'Exact IP', 'IP mentions'),
      google(`site:shodan.io "${v}"`, 'Shodan', 'Infra'),
      google(`site:virustotal.com "${v}"`, 'VirusTotal', 'Reputation'),
      bing(`"${v}"`, 'IP · Bing')
    )
  } else {
    dorks.push(
      google(`"${v}"`, `Exact "${v.slice(0, 24)}"`, 'Direct mentions'),
      bing(`"${v}"`, 'Exact · Bing'),
      ddg(`"${v}"`, 'Exact · DDG')
    )
  }

  // Always add Yandex as strong on forums/social
  dorks.push({
    name: 'Yandex dork',
    url: `https://yandex.com/search/?text=${q(`"${v}"`)}`,
    note: 'Strong on forums/social leaks',
    engine: 'yandex',
  })

  return dorks
}

export function dorkScan(target) {
  const { kind, value } = target
  const dorks = buildDorks({ kind, value })
  if (!dorks.length) throw new Error('No dorks generated')
  // Return as findings with kind @ so they append to parent evidence and render as links
  return dorks.map((d) => ({
    kind: '@',
    source: `Dork · ${d.engine}`,
    detail: `${d.name} — ${d.note}`,
    url: d.url,
    meta: { dork: true, engine: d.engine, target: value },
  }))
}
