const XON_API = 'https://api.xposedornot.com/v1/check-email'
const XON_ANALYTICS_API = 'https://api.xposedornot.com/v1/breach-analytics'
const XON_BREACHES_API = 'https://api.xposedornot.com/v1/breaches'
const HIBP_BREACH_API = 'https://haveibeenpwned.com/api/v3/breachedaccount'
const HIBP_BREACHES_API = 'https://haveibeenpwned.com/api/v3/breaches'
const HR_EMAIL_API = 'https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email'
const HR_USERNAME_API = 'https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-username'

import { parsePhoneLocal, summarizeParsed, enrichPhoneLive, buildPhonePivots, describeLineType } from './phone.js'

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

// ---------- Hudson Rock stealer-log intelligence (free, no key, CORS-open) ----------
function hrSeverity(stealers) {
  const corporate = stealers.reduce((n, s) => n + (s.total_corporate_services || 0), 0)
  if (corporate > 0 || stealers.length > 2) return 'high'
  return 'medium'
}

function hrFamilies(stealers) {
  return [...new Set(stealers.map((s) => s.stealer_family).filter(Boolean))]
}

function summarizeStealers(stealers) {
  const total = stealers.length
  const families = hrFamilies(stealers)
  const dates = stealers.map((s) => s.date_compromised).filter(Boolean).sort()
  const latest = dates.length ? String(dates[dates.length - 1]).slice(0, 10) : ''
  const corporate = stealers.reduce((n, s) => n + (s.total_corporate_services || 0), 0)
  const userCreds = stealers.reduce((n, s) => n + (s.total_user_services || 0), 0)
  const parts = [`${total} infected computer${total === 1 ? '' : 's'}`]
  if (families.length) parts.push(`family: ${families.slice(0, 3).join(', ')}`)
  if (latest) parts.push(`latest: ${latest}`)
  parts.push(`${corporate} corporate + ${userCreds} personal credential set(s) exposed`)
  return parts.join(' — ')
}

async function hudsonRockEmail(email) {
  try {
    const { status, data } = await fetchJson(`${HR_EMAIL_API}?email=${encodeURIComponent(email)}`, { timeout: 12000 })
    if (status === 404 || !data) return null
    const stealers = Array.isArray(data.stealers) ? data.stealers : []
    if (!stealers.length) {
      return {
        kind: '@',
        source: 'Exposure · Hudson Rock',
        detail: `No infostealer infections reference ${email} in Hudson Rock's stealer-log database — no result`,
        url: `https://www.hudsonrock.com/free-tools`,
        meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'hudsonrock', target: email },
      }
    }
    return {
      kind: '@',
      source: 'Exposure · Hudson Rock',
      detail: `CONFIRMED infostealer compromise — ${summarizeStealers(stealers)}. Credentials saved on those machines are in criminal hands; rotate passwords & enable MFA.`,
      url: `https://www.hudsonrock.com/free-tools`,
      meta: {
        status: 'confirmed',
        confidence: 'high',
        severity: hrSeverity(stealers),
        provider: 'hudsonrock',
        target: email,
        infections: stealers.length,
        families: hrFamilies(stealers),
        latestCompromise: stealers.map((s) => s.date_compromised).filter(Boolean).sort().pop() || '',
        note: 'Passwords/logins are masked by the provider and never displayed here.',
      },
    }
  } catch (e) {
    return {
      kind: '@',
      source: 'Exposure · Hudson Rock',
      detail: `Stealer-log check unavailable for ${email} — ${e.message}. Verify manually at hudsonrock.com/free-tools`,
      url: `https://www.hudsonrock.com/free-tools`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hudsonrock', error: e.message },
    }
  }
}

async function hudsonRockUsername(username) {
  try {
    const { status, data } = await fetchJson(`${HR_USERNAME_API}?username=${encodeURIComponent(username)}`, { timeout: 12000 })
    if (status === 404 || !data) return null
    const stealers = Array.isArray(data.stealers) ? data.stealers : []
    if (!stealers.length) {
      return {
        kind: '@',
        source: 'Exposure · Hudson Rock',
        detail: `No infostealer infections reference the username "${username}" — no result`,
        url: `https://www.hudsonrock.com/free-tools`,
        meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'hudsonrock', target: username },
      }
    }
    return {
      kind: '@',
      source: 'Exposure · Hudson Rock',
      detail: `Username appears in infostealer logs — ${summarizeStealers(stealers)}. Possible match: usernames are not unique.`,
      url: `https://www.hudsonrock.com/free-tools`,
      meta: {
        status: 'confirmed',
        confidence: 'medium',
        severity: hrSeverity(stealers),
        provider: 'hudsonrock',
        target: username,
        infections: stealers.length,
        families: hrFamilies(stealers),
        note: 'Usernames can collide across people — treat as strong lead, verify via linked emails.',
      },
    }
  } catch (e) {
    return {
      kind: '@',
      source: 'Exposure · Hudson Rock',
      detail: `Stealer-log check unavailable for "${username}" — ${e.message}. Verify manually at hudsonrock.com/free-tools`,
      url: `https://www.hudsonrock.com/free-tools`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hudsonrock', error: e.message },
    }
  }
}

// ---------- XposedOrNot breach analytics (free, no key, CORS-open) ----------
function summarizeAnalytics(data) {
  try {
    const metrics = data.BreachMetrics || {}
    const riskArr = metrics.risk || []
    const risk = riskArr[0]?.risk_label || ''
    const pw = (metrics.passwords_strength || [])[0] || {}
    const pastes = data.PastesSummary?.count
    const xposed = (data.xposed_data || [])
      .flatMap((g) => g.children || [])
      .map((c) => `${String(c.name || '').replace(/^data_/, '')} (${c.value})`)
      .slice(0, 6)
      .join(', ')
    const bits = []
    if (risk) bits.push(`XON risk label: ${risk}`)
    if (xposed) bits.push(`data types seen: ${xposed}`)
    const pwBits = ['EasyToCrack', 'PlainText', 'StrongHash'].filter((k) => (pw[k] || 0) > 0).map((k) => `${pw[k]}× ${k}`)
    if (pwBits.length) bits.push(`password strength in breaches: ${pwBits.join(', ')}`)
    if (typeof pastes === 'number' && pastes > 0) bits.push(`paste exposures: ${pastes}`)
    return bits.join(' · ')
  } catch {
    return ''
  }
}

async function xonBreachAnalytics(email) {
  try {
    const { status, data } = await fetchJson(`${XON_ANALYTICS_API}?email=${encodeURIComponent(email)}`, { timeout: 10000 })
    if (status === 404 || !data) return null
    const summary = summarizeAnalytics(data)
    if (!summary) return null
    const riskLabel = data?.BreachMetrics?.risk?.[0]?.risk_label || ''
    return {
      kind: '@',
      source: 'Exposure · XON Analytics',
      detail: `Breach analytics for ${email} — ${summary}`,
      url: `https://xposedornot.com/`,
      meta: {
        status: 'intel',
        confidence: 'high',
        severity: /high|critical/i.test(riskLabel) ? 'high' : 'low',
        provider: 'xposedornot-analytics',
        target: email,
        riskLabel,
        riskScore: data?.BreachMetrics?.risk?.[0]?.risk_score ?? '',
      },
    }
  } catch {
    return null // analytics is a bonus — silent skip keeps core checks authoritative
  }
}

// ---------- Email ----------
// Three independent providers run concurrently; each degrades gracefully. No keys required.
async function exposureEmail(email) {
  const findings = []
  const hibpKey = getStoredHibpKey()

  const [xonResult, hrResult, analyticsResult] = await Promise.allSettled([
    xonCheckEmail(email),
    hudsonRockEmail(email),
    xonBreachAnalytics(email),
  ])

  if (xonResult.status === 'fulfilled') {
    findings.push(...xonResult.value)
  } else if (hibpKey) {
    try {
      findings.push(...(await exposureEmailHibp(email, hibpKey)))
    } catch (e2) {
      findings.push({
        kind: '@',
        source: 'Exposure · HIBP',
        detail: `Provider unavailable for ${email} — ${e2.message}. Check directly at haveibeenpwned.com`,
        url: `https://haveibeenpwned.com/`,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp', error: e2.message },
      })
    }
  } else {
    findings.push({
      kind: '@',
      source: 'Exposure · XposedOrNot',
      detail: `Provider unavailable for ${email} — ${xonResult.reason?.message || 'network/CORS blocked'}. Verify manually at haveibeenpwned.com or xposedornot.com`,
      url: `https://haveibeenpwned.com/`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'xposedornot', error: String(xonResult.reason?.message || '') },
    })
  }

  if (hrResult.status === 'fulfilled' && hrResult.value) findings.push(hrResult.value)
  if (analyticsResult.status === 'fulfilled' && analyticsResult.value) findings.push(analyticsResult.value)

  return findings
}

async function xonCheckEmail(email) {
  const url = `${XON_API}/${encodeURIComponent(email)}`
  const { status, data } = await fetchJson(url, { timeout: 10000 })
  if (status === 404 || !data) {
    return [
      {
        kind: '@',
        source: 'Exposure · XposedOrNot',
        detail: `No known breaches for ${email} — no result`,
        url: `https://xposedornot.com/`,
        meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'xposedornot' },
      },
    ]
  }
  // XON returns breaches array or similar — may be nested: [["Adobe","2013-10-04"],...]
  const breaches = data.breaches || data.exposedBreaches || data.Breaches || []
  let breachList = Array.isArray(breaches) ? breaches : []
  if (breachList.length && Array.isArray(breachList[0])) {
    breachList = breachList.map((b) => (Array.isArray(b) ? { Name: b[0], BreachDate: b[1] || '', DataClasses: b.slice(2) } : b))
  }
  if (data.status === 'breached' || breachList.length > 0 || data.breached === true) {
    const list = breachList.length ? breachList : (Array.isArray(data) ? (Array.isArray(data[0]) ? data.map((b) => (Array.isArray(b) ? { Name: b[0] } : b)) : data) : [])
    const findings = list.slice(0, 12).map((b) => {
      const name = typeof b === 'string' ? b : b.Name || b.name || b.Breach || 'Unknown breach'
      const date = typeof b === 'string' ? '' : b.BreachDate || b.breachDate || b.AddedDate || ''
      const classes = typeof b === 'string' ? '' : (b.DataClasses || b.dataClasses || []).join(', ')
      return {
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
      }
    })
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
  return [
    {
      kind: '@',
      source: 'Exposure · XposedOrNot',
      detail: `No known breaches for ${email} — no result`,
      url: `https://xposedornot.com/`,
      meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'xposedornot' },
    },
  ]
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

// ---------- Domain ----------
// HIBP's unauthenticated breach-catalog filter is CORS-open (verified); XposedOrNot is the key-free fallback
async function exposureDomain(domain) {
  const findings = []
  try {
    const url = `${HIBP_BREACHES_API}?domain=${encodeURIComponent(domain)}`
    const { data } = await fetchJson(url, { timeout: 12000 })
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
  } catch (hibpErr) {
    // Fallback: XposedOrNot breach catalog filtered by domain (free, CORS-open)
    try {
      const { status, data } = await fetchJson(`${XON_BREACHES_API}?domain=${encodeURIComponent(domain)}`, { timeout: 12000 })
      const all = Array.isArray(data) ? data : []
      const matches = all.filter((b) => {
        const d = String(b.Domain || b.domain || '').toLowerCase()
        return !d || d === domain || d.endsWith(`.${domain}`)
      })
      if (status === 404 || matches.length === 0) {
        findings.push({
          kind: '@',
          source: 'Exposure · XposedOrNot',
          detail: `No known breaches involving domain ${domain} (HIBP unreachable: ${hibpErr.message}) — no result`,
          url: `https://xposedornot.com/breaches`,
          meta: { status: 'no_result', confidence: 'low', severity: 'none', provider: 'xposedornot', target: domain },
        })
      } else {
        for (const b of matches.slice(0, 10)) {
          const name = b.BreachID || b.Name || b.name || 'Unknown breach'
          const classesArr = [].concat(b['Data Classes'] || b.DataClasses || [])
          const date = b['Breach Date'] || b.BreachDate || b.breachDate || ''
          findings.push({
            kind: 'breach',
            value: name,
            source: 'Exposure · XposedOrNot',
            detail: `${name}${date ? ` — ${String(date).slice(0, 10)}` : ''} — domain: ${domain}${classesArr.length ? ` — exposed: ${classesArr.join(', ').slice(0, 80)}` : ''}`,
            url: `https://xposedornot.com/breaches`,
            meta: {
              status: 'possible',
              confidence: 'medium',
              severity: breachSeverity({ DataClasses: classesArr }),
              breachName: name,
              breachDate: date,
              dataClasses: classesArr.join(', '),
              provider: 'xposedornot',
              target: domain,
            },
          })
        }
      }
      return findings
    } catch (xonErr) {
      findings.push({
        kind: '@',
        source: 'Exposure · HIBP/XON',
        detail: `Provider unavailable for domain ${domain} — HIBP: ${hibpErr.message}; XposedOrNot: ${xonErr.message}. Check haveibeenpwned.com directly`,
        url: `https://haveibeenpwned.com/`,
        meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'hibp+xon', error: hibpErr.message },
      })
      return findings
    }
  }
}

// ---------- Username ----------
// Hudson Rock stealer-log search runs free in-browser; HIBP catalogs need a proxy (their API is no-CORS for authenticated endpoints by policy)
async function exposureUsername(username) {
  const findings = []
  const hr = await hudsonRockUsername(username)
  if (hr) findings.push(hr)
  findings.push({
    kind: '@',
    source: 'Exposure · Note',
    detail: `Breach catalogs tied to a username (HIBP-style) need a server-side proxy in this browser-only build. The free stealer-log check above covers infostealer infections; for full catalog coverage resolve the username to an email and run an email exposure check.`,
    url: `https://haveibeenpwned.com/`,
    meta: { status: 'intel', confidence: 'high', severity: 'none', provider: 'none', target: username },
  })
  return findings
}

// ---------- Phone ----------
// Fully key-free: offline libphonenumber parse → live carrier enrichment → stealer/breach pivots.
// No public CORS-open API maps phones to breach data; we never fake results — instead we hand
// you one-click manual checks plus every format-variant search dork (the PhoneInfoga playbook).
async function exposurePhone(normalizedPhone) {
  const findings = []
  const parsed = parsePhoneLocal(normalizedPhone)

  if (!parsed) {
    return [
      {
        kind: '@',
        source: 'Exposure · Phone Intel',
        detail: `"${normalizedPhone}" does not parse as a valid phone number (check country code — international format like +919876543210 works best). No lookups were sent.`,
        url: undefined,
        meta: { status: 'no_result', confidence: 'high', severity: 'none', provider: 'local', target: normalizedPhone },
      },
    ]
  }

  const info = summarizeParsed(parsed)

  // 1. Offline intel — instant, always works
  findings.push({
    kind: '@',
    source: 'Exposure · Phone Intel',
    detail: `${info.international} — ${info.valid ? 'valid' : 'invalid'} number · line type: ${describeLineType(info.lineType)} · country: +${info.countryCode}${info.country ? ` (${info.country})` : ''} · formats: E.164 ${info.e164}, national ${info.national}`,
    url: info.rfc3966,
    meta: {
      status: 'intel',
      confidence: 'high',
      severity: 'none',
      provider: 'libphonenumber-offline',
      target: info.e164,
      ...info,
    },
  })

  // 2. Live enrichment — carrier/region/timezone/disposable (5 req/min free tier)
  let live = null
  try {
    live = await enrichPhoneLive(info.e164)
    const bits = []
    if (live.carrier) bits.push(`carrier: ${live.carrier}`)
    const place = [...new Set([live.city, live.region, live.countryName].filter(Boolean))].join(', ')
    if (place && place !== live.countryName) bits.push(`region: ${place}`)
    else if (live.countryName) bits.push(`country: ${live.countryName}`)
    if (live.timezone) bits.push(`timezone: ${live.timezone}`)
    if (live.disposable) bits.push('⚠ disposable/virtual number')
    findings.push({
      kind: '@',
      source: 'Exposure · Phone Intel',
      detail: `Live lookup — ${bits.length ? bits.join(' · ') : 'no additional data'}. Free tier: 5 lookups/min.`,
      url: `https://phone-number-api.com/`,
      meta: { status: 'intel', confidence: 'medium', severity: live.disposable ? 'medium' : 'none', provider: 'phone-number-api.com', target: info.e164, ...live },
    })
  } catch (e) {
    findings.push({
      kind: '@',
      source: 'Exposure · Phone Intel',
      detail: `Live carrier lookup unavailable — ${e.message}. Offline analysis above still stands.`,
      url: `https://phone-number-api.com/`,
      meta: { status: 'provider_unavailable', confidence: 'low', severity: 'none', provider: 'phone-number-api.com', error: e.message },
    })
  }

  // 3. Pivot deep-links — where the number's footprint actually lives
  const pivots = buildPhonePivots(parsed)
  findings.push({
    kind: '@',
    source: 'Exposure · Phone Intel',
    detail: `${pivots.length} pivot searches ready — Truecaller/Sync.me caller ID, WhatsApp registration probe, Google/Bing/DDG/Yandex dorks across all format variants, DeHashed leak search. One click each; results open in new tabs and stay out of your graph until you log them.`,
    url: pivots[0]?.url,
    meta: {
      status: 'intel',
      confidence: 'medium',
      severity: 'none',
      provider: 'pivots',
      target: info.e164,
      links: pivots,
    },
  })

  // 4. Honest note on breach coverage
  findings.push({
    kind: '@',
    source: 'Exposure · Note',
    detail: `No free, key-less API exposes phone-number breach data from a browser (HIBP phone search needs a paid key behind a proxy). Use the pivot links above to check manually — we don't fake results.`,
    url: `https://haveibeenpwned.com/`,
    meta: { status: 'intel', confidence: 'high', severity: 'none', provider: 'none', target: info.e164 },
  })

  return findings
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
