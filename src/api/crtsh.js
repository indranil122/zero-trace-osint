export function buildCrtshFindings(rows, domain) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No certificates found for this domain')
  }

  const seen = new Map()
  for (const row of rows) {
    for (let nv of String(row.name_value || '').split('\n')) {
      nv = nv.trim().toLowerCase().replace(/^\*\./, '')
      if (nv !== domain && !nv.endsWith(`.${domain}`)) continue
      seen.set(nv, (seen.get(nv) || 0) + 1)
    }
  }

  const subs = [...seen.keys()].filter((s) => s !== domain).sort().slice(0, 150)
  if (!subs.length && !seen.has(domain)) {
    throw new Error('Certificates exist but reveal no hostnames')
  }

  const findings = [
    {
      kind: '@',
      source: 'Certificate transparency · crt.sh',
      detail: `${seen.size} unique hostname(s) across ${rows.length} certificate log entries`,
      url: `https://crt.sh/?q=${encodeURIComponent(domain)}`,
    },
  ]

  for (const sub of subs) {
    findings.push({
      kind: 'subdomain',
      value: sub,
      source: 'Certificate transparency · crt.sh',
      detail: `Seen in ${seen.get(sub)} certificate(s)`,
      url: `https://crt.sh/?q=${sub}`,
    })
  }
  return findings
}

function fetchViaWorker(url) {
  return new Promise((resolve, reject) => {
    let worker
    try {
      worker = new Worker(new URL('../workers/crtsh.worker.js', import.meta.url), { type: 'module' })
    } catch {
      reject(new Error('no-worker'))
      return
    }
    const timer = setTimeout(() => {
      worker.terminate()
      reject(new Error('worker timeout'))
    }, 60000)
    worker.onmessage = (e) => {
      clearTimeout(timer)
      worker.terminate()
      if (e.data?.ok) resolve(e.data.rows)
      else reject(new Error(e.data?.error || 'worker failed'))
    }
    worker.onerror = () => {
      clearTimeout(timer)
      worker.terminate()
      reject(new Error('worker crashed'))
    }
    worker.postMessage({ url })
  })
}

async function fetchInline(url) {
  const routes = [
    url,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://proxy.corsfix.com/?${encodeURIComponent(url)}`,
    `https://yacdn.org/proxy/${url}`,
  ]
  let lastErr = null
  for (const route of routes) {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 18000)
    try {
      const r = await fetch(route, { headers: { accept: 'application/json' }, signal: ctl.signal })
      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status} from ${new URL(route).hostname}`)
        continue
      }
      const text = await r.text()
      if (!text || text.trim().startsWith('<')) throw new Error('Received HTML instead of JSON (blocked)')
      return JSON.parse(text)
    } catch (e) {
      lastErr = e
      if (e.name === 'AbortError') lastErr = new Error('Timed out — check connection')
      continue
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(
    lastErr?.message?.includes('Timed out')
      ? 'crt.sh timed out — network slow or blocked. Try again, or use DNS/Wayback for subdomains.'
      : `crt.sh unreachable (tried ${routes.length} routes). Last: ${lastErr?.message || 'blocked'}. Try again or use DNS/Wayback.`
  )
}

export async function crtshScan(domain) {
  const target = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`
  let rows
  try {
    rows = await fetchViaWorker(target)
  } catch {
    rows = await fetchInline(target)
  }
  return buildCrtshFindings(rows, domain)
}
