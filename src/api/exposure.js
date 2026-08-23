const XON_API = 'https://api.xposedornot.com/v1/check-email'
const HIBP_BREACH_API = 'https://haveibeenpwned.com/api/v3/breachedaccount'
const HIBP_BREACHES_API = 'https://haveibeenpwned.com/api/v3/breaches'

function getStoredHibpKey() {
  try {
    return localStorage.getItem('zt-hibp-key') || ''
  } catch {
    return ''
  }
}

export function setStoredHibpKey(key) {
  try {
    if (key) localStorage.setItem('zt-hibp-key', key)
    else localStorage.removeItem('zt-hibp-key')
  } catch {}
}

export { getStoredHibpKey }

async function fetchJson(url, { headers = {}, timeout = 12000 } = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await fetch(url, { headers, signal: ctl.signal })
    if (r.status === 404) return { status: 404, data: null }
    if (r.status === 429) throw new Error('Rate limited — try again shortly')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const text = await r.text()
    if (!text) return { status: r.status, data: null }
    return { status: r.status, data: JSON.parse(text) }
  } finally {
    clearTimeout(timer)
  }
}

// Normalize helpers
function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase()
}
function normalizePhone(v) {
  return String(v || '').trim().replace(/[\s\-()]/g, '')
}
function normalizeUsername(v) {
  return String(v || '').trim().replace(/^@+/, '')
}
function normalizeDomain(v) {
  return String(v || '').trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]
}

// Severity mapping for breaches (based on data classes)
function breachSeverity(breach) {
  const classes = (breach.DataClasses || breach.dataClasses || []).join(' ').toLowerCase()
  if (classes.includes('password') || classes.includes('financial') || classes.includes('credit')) return 'high'
  if (classes.includes('email') || classes.includes('phone') || classes.includes('location')) return 'medium'
  return 'low'
}

export async function exposureScan(target) {
  const { kind, value, file } = target
  const normalized = normalizeValueForKind(kind, value)
  if (!normalized && kind !== 'image') throw new Error('Invalid target value')

  // Route to appropriate handler
  if (kind === 'email') return exposureEmail(normalized)
  if (kind === 'domain') return exposureDomain(normalized)
  if (kind === 'username') return exposureUsername(normalized)
  if (kind === 'phone') return exposurePhone(normalized)
  if (kind === 'name') return exposureName(normalized)
  if (kind === 'image' && file) return exposureImage(file, normalized)
  if (kind === 'image' && !file) return exposureImageHash(normalized)
  throw new Error(`Exposure check not supported for kind: ${kind}`)
}

function normalizeValueForKind(kind, value) {
  if (kind === 'email') return normalizeEmail(value)
  if (kind === 'phone') return normalizePhone(value)
  if (kind === 'username') return normalizeUsername(value)
  if (kind === 'domain') return normalizeDomain(value)
  if (kind === 'name') return String(value || '').trim()
  if (kind === 'image') return String(value || '').trim()
  return String(value || '').trim()
}

// Email — XposedOrNot (CORS-open, no key), fallback to HIBP if key present
async function exposureEmail(email) {
  const findings = []
  const hibpKey = getStoredHibpKey()

  // Try XposedOrNot first (browser-friendly)
  try {
    const url = `${XON_API}/${encodeURIComponent(email)}`
    const { status, data } = await fetchJson(url, { timeout: 10000 })
    if (status === 404 || !data) {
      // No breach found — XON returns 404 or empty
      findings.push({
        kind: '@',
        source: 'Exposure · XposedOrNot',
        detail: `No known breaches for ${email} — no result`,
        url: `https://xposedornot.com/`,
        meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'xposedornot' },
      })
      return findings
    }
    // XON returns breaches array or similar — may be nested: [["Adobe","2013-10-04"],...]
    const breaches = data.breaches || data.exposedBreaches || data.Breaches || []
    let breachList = Array.isArray(breaches) ? breaches : []
    if (breachList.length && Array.isArray(breachList[0])) {
      breachList = breachList.map((b) => (Array.isArray(b) ? { Name: b[0], BreachDate: b[1] || '', DataClasses: b.slice(2) } : b))
    }
    if (data.status === 'breached' || breachList.length > 0 || data.breached === true) {
      const list = breachList.length ? breachList : (Array.isArray(data) ? (Array.isArray(data[0]) ? data.map((b) => (Array.isArray(b) ? { Name: b[0] } : b)) : data) : [])
      for (const b of list.slice(0, 12)) {
        const name = typeof b === 'string' ? b : b.Name || b.name || b.Breach || 'Unknown breach'
        const date = typeof b === 'string' ? '' : b.BreachDate || b.breachDate || b.AddedDate || ''
        const classes = typeof b === 'string' ? '' : (b.DataClasses || b.dataClasses || []).join(', ')
        findings.push({
          kind: 'breach',
          value: name,
          source: 'Exposure · XposedOrNot',
          detail: `${name}${date ? ` — ${date.slice(0, 10)}` : ''}${classes ? ` — exposed: ${classes.slice(0, 80)}` : ''}`,
          url: `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(name)}`,
          meta: {
            status: 'confirmed',
            confidence: 'high',
            severity: breachSeverity(b),
            breachName: name,
            breachDate: date,
            dataClasses: classes,
            provider: 'xposedornot',
            target: email,
          },
        })
      }
      if (!findings.some((f) => f.kind === 'breach')) {
        findings.push({
          kind: '@',
          source: 'Exposure · XposedOrNot',
          detail: `Confirmed exposure for ${email} — ${breachList.length} breach(s) found`,
          url: `https://xposedornot.com/`,
          meta: { status: 'confirmed', confidence: 'high', severity: 'high', provider: 'xposedornot' },
        })
      }
      return findings
    }
    // Not breached
    findings.push({
      kind: '@',
      source: 'Exposure · XposedOrNot',
      detail: `No known breaches for ${email} — no result`,
      url: `https://xposedornot.com/`,
      meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'xposedornot' },
    })
    return findings
  } catch (e) {
    if (e.message.includes('Rate limited')) {
      findings.push({
        kind: '@',
        source: 'Exposure · XposedOrNot',
        detail: `Provider rate limited for ${email} — try again shortly`,
        url: `https://xposedornot.com/`,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'xposedornot', error: e.message },
      })
      return findings
    }
    // CORS/network error — try HIBP if key available, else mark unavailable
    if (hibpKey) {
      try {
        return await exposureEmailHibp(email, hibpKey)
      } catch (e2) {
        findings.push({
          kind: '@',
          source: 'Exposure · HIBP',
          detail: `Provider unavailable for ${email} — ${e2.message}. Check directly at haveibeenpwned.com`,
          url: `https://haveibeenpwned.com/`,
          meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp', error: e2.message },
        })
        return findings
      }
    }
    findings.push({
      kind: '@',
      source: 'Exposure · XposedOrNot',
      detail: `Provider unavailable for ${email} — ${e.message}. CORS or network blocked. Verify manually at haveibeenpwned.com or xposedornot.com`,
      url: `https://haveibeenpwned.com/`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'xposedornot', error: e.message },
    })
    return findings
  }
}

async function exposureEmailHibp(email, key) {
  const url = `${HIBP_BREACH_API}/${encodeURIComponent(email)}?truncateResponse=false`
  const { status, data } = await fetchJson(url, { headers: { 'hibp-api-key': key }, timeout: 10000 })
  if (status === 404 || !data || (Array.isArray(data) && data.length === 0)) {
    return [
      {
        kind: '@',
        source: 'Exposure · HIBP',
        detail: `No known breaches for ${email} — no result`,
        url: `https://haveibeenpwned.com/`,
        meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'hibp' },
      },
    ]
  }
  const breaches = Array.isArray(data) ? data : [data]
  return breaches.slice(0, 12).map((b) => ({
    kind: 'breach',
    value: b.Name || b.name || 'Unknown breach',
    source: 'Exposure · HIBP',
    detail: `${b.Name || 'Unknown'} — ${b.BreachDate ? b.BreachDate.slice(0, 10) : ''} — exposed: ${(b.DataClasses || []).join(', ').slice(0, 80)}`,
    url: `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.Name || '')}`,
    meta: {
      status: 'confirmed',
      confidence: 'high',
      severity: breachSeverity(b),
      breachName: b.Name,
      breachDate: b.BreachDate,
      dataClasses: (b.DataClasses || []).join(', '),
      provider: 'hibp',
      target: email,
    },
  }))
}

async function exposureDomain(domain) {
  const hibpKey = getStoredHibpKey()
  const findings = []
  // Try HIBP breaches?domain= — public, no key needed for this endpoint, but rate limited
  try {
    const url = `${HIBP_BREACHES_API}?domain=${encodeURIComponent(domain)}`
    const headers = hibpKey ? { 'hibp-api-key': hibpKey } : {}
    const { data } = await fetchJson(url, { headers, timeout: 10000 })
    const breaches = Array.isArray(data) ? data : []
    if (breaches.length === 0) {
      findings.push({
        kind: '@',
        source: 'Exposure · HIBP',
        detail: `No known breaches involving domain ${domain} — no result`,
        url: `https://haveibeenpwned.com/`,
        meta: { status: 'no_result', confidence: 'medium', severity: 'none', provider: 'hibp', target: domain },
      })
    } else {
      for (const b of breaches.slice(0, 10)) {
        findings.push({
          kind: 'breach',
          value: b.Name || b.name || 'Unknown breach',
          source: 'Exposure · HIBP',
          detail: `${b.Name || 'Unknown'} — ${b.BreachDate ? b.BreachDate.slice(0, 10) : ''} — domain: ${domain} — exposed: ${(b.DataClasses || []).join(', ').slice(0, 80)}`,
          url: `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.Name || '')}`,
          meta: {
            status: 'possible',
            confidence: 'medium',
            severity: breachSeverity(b),
            breachName: b.Name,
            breachDate: b.BreachDate,
            dataClasses: (b.DataClasses || []).join(', '),
            provider: 'hibp',
            target: domain,
          },
        })
      }
    }
    return findings
  } catch (e) {
    findings.push({
      kind: '@',
      source: 'Exposure · HIBP',
      detail: `Provider unavailable for domain ${domain} — ${e.message}. Check haveibeenpwned.com directly`,
      url: `https://haveibeenpwned.com/`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp', error: e.message },
    })
    return findings
  }
}

async function exposureUsername(username) {
  const hibpKey = getStoredHibpKey()
  if (!hibpKey) {
    return [
      {
        kind: '@',
        source: 'Exposure · HIBP',
        detail: `Username exposure check requires HIBP API key (Settings → HIBP key) — provider unavailable for ${username}. Username itself not sensitive, but breaches are tied to emails. Try email instead, or add key.`,
        url: `https://haveibeenpwned.com/`,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp', target: username },
      },
    ]
  }
  try {
    const url = `${HIBP_BREACH_API}/${encodeURIComponent(username)}?truncateResponse=false`
    const { status, data } = await fetchJson(url, { headers: { 'hibp-api-key': hibpKey }, timeout: 10000 })
    if (status === 404) {
      return [
        {
          kind: '@',
          source: 'Exposure · HIBP',
          detail: `Provider unavailable for username ${username} — HIBP returned 404. Username lookups are not reliable via this endpoint; resolve username to an email first for a definitive no-result, or verify manually at haveibeenpwned.com`,
          url: `https://haveibeenpwned.com/`,
          meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp', target: username },
        },
      ]
    }
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return [
        {
          kind: '@',
          source: 'Exposure · HIBP',
          detail: `No known breaches for username ${username} — no result (HIBP)`,
          url: `https://haveibeenpwned.com/`,
          meta: { status: 'no_result', confidence: 'medium', severity: 'none', provider: 'hibp' },
        },
      ]
    }
    const breaches = Array.isArray(data) ? data : [data]
    return breaches.slice(0, 10).map((b) => ({
      kind: 'breach',
      value: b.Name || 'Unknown breach',
      source: 'Exposure · HIBP',
      detail: `${b.Name || 'Unknown'} — ${b.BreachDate ? b.BreachDate.slice(0, 10) : ''} — username: ${username}`,
      url: `https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b.Name || '')}`,
      meta: { status: 'possible', confidence: 'medium', severity: breachSeverity(b), provider: 'hibp', target: username },
    }))
  } catch (e) {
    return [
      {
        kind: '@',
        source: 'Exposure · HIBP',
        detail: `Provider unavailable for ${username} — ${e.message}`,
        url: `https://haveibeenpwned.com/`,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp', error: e.message },
      },
    ]
  }
}

async function exposurePhone(phone) {
  return [
    {
      kind: '@',
      source: 'Exposure · Phone',
      detail: `Phone exposure check for ${phone} — provider unavailable. No free browser CORS provider for phone breaches. Verify manually via your carrier or breach service (e.g., haveibeenpwned.com supports phone with key, or check DeHashed with BYO key). No data sent.`,
      url: `https://haveibeenpwned.com/`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'none', target: phone },
    },
  ]
}

async function exposureName(name) {
  return [
    {
      kind: '@',
      source: 'Exposure · Name',
      detail: `Name exposure check for “${name}” — possible match only. Names are not unique; any breach containing this name is a possible match, not confirmed. Use email/username for precise checks.`,
      url: `https://haveibeenpwned.com/`,
      meta: { status: 'possible', confidence: 'low', severity: 'low', provider: 'none', target: name },
    },
  ]
}

async function exposureImage(file, value) {
  // Compute SHA-256 hash locally, never upload
  try {
    const buf = await file.arrayBuffer()
    const hashBuf = await crypto.subtle.digest('SHA-256', buf)
    const hashHex = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    return [
      {
        kind: '@',
        source: 'Exposure · Image (local)',
        detail: `Local SHA-256: ${hashHex.slice(0, 16)}… — image not uploaded. To verify exposure, search hash manually on VirusTotal (https://www.virustotal.com/gui/search/${hashHex}) or keep EXIF analysis local.`,
        url: `https://www.virustotal.com/gui/search/${hashHex}`,
        meta: {
          status: 'possible',
          confidence: 'low',
          severity: 'low',
          provider: 'local',
          hash: hashHex,
          fileName: file.name,
          fileSize: file.size,
          target: value,
        },
      },
    ]
  } catch (e) {
    return [
      {
        kind: '@',
        source: 'Exposure · Image (local)',
        detail: `Image hash failed — ${e.message}. Image not uploaded.`,
        url: undefined,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'local', error: e.message },
      },
    ]
  }
}

async function exposureImageHash(hash) {
  const h = String(hash || '').trim().toLowerCase()
  if (!/^[a-f0-9]{32,64}$/.test(h)) {
    return [
      {
        kind: '@',
        source: 'Exposure · Image hash',
        detail: `Hash “${h.slice(0, 16)}…” not a valid MD5/SHA-256. Provide full hash to check manually.`,
        url: undefined,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'none' },
      },
    ]
  }
  return [
    {
      kind: '@',
      source: 'Exposure · Image hash',
      detail: `Hash ${h.slice(0, 16)}… — check manually on VirusTotal: https://www.virustotal.com/gui/search/${h}`,
      url: `https://www.virustotal.com/gui/search/${h}`,
      meta: { status: 'possible', confidence: 'low', severity: 'low', provider: 'manual', hash: h },
    },
  ]
}
