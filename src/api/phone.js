// Key-free phone intelligence — everything runs in the browser.
// 1. Offline parse via libphonenumber (validity, country, line type, formats)
// 2. Optional live enrichment via phone-number-api.com demo endpoint (no key, CORS-open)
// 3. Pivot deep-links (WhatsApp, Truecaller, Sync.me, search dorks) — same playbook as
//    PhoneInfoga/clank/phoneosint but zero-install and zero-key.
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

const LIVE_API = 'https://demo.phone-number-api.com/json/?number='

let _fetch = (...args) => fetch(...args)
export function _setFetcher(fn) {
  _fetch = fn
}

export function parsePhoneLocal(raw) {
  const cleaned = String(raw || '').trim()
  if (!cleaned) return null
  const hasPlus = cleaned.startsWith('+') || cleaned.startsWith('00')
  const digits = cleaned.replace(/[^\d+]/g, '')
  if (!digits || !/^[+\d][\d\s\-().]{5,}$/.test(cleaned)) return null

  // Try as-is; if no + prefix, retry with common default regions so local formats still parse
  const attempts = []
  if (hasPlus) {
    attempts.push([digits.replace(/^00/, '+'), undefined])
  } else {
    for (const region of ['US', 'GB', 'IN', 'DE', 'NG', 'BR']) attempts.push([digits, region])
  }
  for (const [candidate, region] of attempts) {
    try {
      const parsed = parsePhoneNumberFromString(candidate, region)
      if (parsed && parsed.isValid()) return parsed
    } catch {}
  }
  return null
}

function guessCountryFromDialCode(digits) {
  // Minimal fallback map for numbers libphonenumber can't fully validate but that
  // clearly carry a country calling code. Only used to build pivots, never claims validity.
  const map = [
    ['1', 'US'], ['7', 'RU'], ['20', 'EG'], ['27', 'ZA'], ['31', 'NL'], ['33', 'FR'],
    ['34', 'ES'], ['39', 'IT'], ['44', 'GB'], ['49', 'DE'], ['55', 'BR'], ['61', 'AU'],
    ['81', 'JP'], ['86', 'CN'], ['90', 'TR'], ['91', 'IN'], ['92', 'PK'], ['98', 'IR'],
    ['212', 'MA'], ['234', 'NG'], ['254', 'KE'], ['351', 'PT'], ['880', 'BD'], ['971', 'AE'],
  ]
  const d = String(digits).replace(/^\+/, '')
  for (const len of [3, 2, 1]) {
    const hit = map.find(([code]) => d.startsWith(code) && code.length === len)
    if (hit) return hit[1]
  }
  return null
}

export function summarizeParsed(parsed) {
  const country = parsed.country || null
  return {
    valid: parsed.isValid(),
    possible: parsed.isPossible(),
    e164: parsed.number,
    international: parsed.formatInternational(),
    national: parsed.formatNational(),
    rfc3966: parsed.getURI(),
    countryCode: parsed.countryCallingCode,
    country,
    nationalNumber: parsed.nationalNumber.toString(),
    lineType: parsed.getType() || 'unknown',
    extension: parsed.ext || null,
  }
}

export async function enrichPhoneLive(e164, { timeout = 8000 } = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await _fetch(`${LIVE_API}${encodeURIComponent(e164.replace(/^\+/, ''))}`, { signal: ctl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    if (!data || data.status !== 'success') throw new Error('Provider returned no data')
    return {
      carrier: data.carrier || null,
      countryName: data.countryName || null,
      region: data.regionName || data.region || null,
      city: data.city || null,
      timezone: data.timezone || null,
      continent: data.continent || null,
      currency: data.currency || null,
      disposable: data.isDisposible === true,
      lat: typeof data.lat === 'number' ? data.lat : null,
      lon: typeof data.lon === 'number' ? data.lon : null,
      provider: 'phone-number-api.com',
    }
  } finally {
    clearTimeout(timer)
  }
}

// Multi-format variants — the xTELENUMSINT trick: search engines index every format people type
export function phoneFormatVariants(parsed) {
  const intlDigits = `+${parsed.countryCallingCode}${parsed.nationalNumber}`
  const spaced = parsed.formatInternational()
  return [intlDigits, spaced, parsed.formatNational(), parsed.nationalNumber.toString()]
}

export function buildPhonePivots(parsed) {
  const e164 = parsed.number
  const cc = (parsed.country || guessCountryFromDialCode(parsed.countryCallingCode) || '').toLowerCase()
  const nationalNoLeadingZero = parsed.nationalNumber.toString()
  const fmts = [...new Set(phoneFormatVariants(parsed))]
  const orQuery = fmts.map((f) => `"${f}"`).join(' OR ')

  const links = [
    { name: 'Truecaller', url: cc ? `https://www.truecaller.com/search/${cc}/${nationalNoLeadingZero}` : '', note: 'Crowdsourced caller ID / name' },
    { name: 'Sync.me', url: `https://sync.me/search/?number=${encodeURIComponent(e164)}`, note: 'Reverse phone lookup' },
    { name: 'WhatsApp', url: `https://wa.me/${e164.replace(/^\+/, '')}`, note: 'Registered on WhatsApp? opens chat draft' },
    { name: 'Google dork', url: `https://www.google.com/search?q=${encodeURIComponent(orQuery)}`, note: 'All formats across the web' },
    { name: 'Bing dork', url: `https://www.bing.com/search?q=${encodeURIComponent(orQuery)}`, note: 'Second engine, different index' },
    { name: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${encodeURIComponent(orQuery)}`, note: 'Privacy-friendly engine' },
    { name: 'Yandex', url: `https://yandex.com/search/?text=${encodeURIComponent(orQuery)}`, note: 'Strong on forums/social leaks' },
    { name: 'HIBP manual', url: 'https://haveibeenpwned.com/', note: 'Phone breach search needs a paid account — check manually' },
    { name: 'DeHashed', url: `https://dehashed.com/search?query=${encodeURIComponent(e164)}`, note: 'Leak search (account required)' },
  ]
  return links.filter((l) => l.url)
}

export function describeLineType(type) {
  const map = {
    MOBILE: 'mobile — SMS/OTP capable, likely personal device',
    FIXED_LINE: 'fixed line — physical location, often a business/home',
    FIXED_LINE_OR_MOBILE: 'fixed line or mobile',
    VOIP: 'VoIP — internet number (Skype/Twilio/burner apps), higher spoof risk',
    PREMIUM_RATE: 'premium rate — charged per call',
    TOLL_FREE: 'toll-free',
    SHARED_COST: 'shared cost',
    PERSONAL_NUMBER: 'personal redirect number',
    PAGER: 'pager',
    UAN: 'universal access number',
    VOICEMAIL: 'voicemail',
  }
  return map[type] || `${type} (carrier-reported)`
}
