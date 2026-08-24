const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi
const PHONE_INTL_RE = /\+\d{1,3}(?:[\s.-]?\d){7,13}/g
const PHONE_NATL_RE = /(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g
const HANDLE_RE = /(?:^|\s)@([a-zA-Z0-9._-]{3,30})/g

export function extractEntities(text) {
  const t = String(text || '')
  const emails = [...new Set((t.match(EMAIL_RE) || []).map((s) => s.toLowerCase()))].slice(0, 50)
  const ips = [...new Set((t.match(IPV4_RE) || []).filter((ip) => ip.split('.').every((o) => Number(o) <= 255)))].slice(0, 50)
  // phone: structured patterns only (international E.164-ish + national NANP-style), skips dates/times
  const phonesRaw = [
    ...(t.match(PHONE_INTL_RE) || []),
    ...(t.match(PHONE_NATL_RE) || []),
  ]
  const phones = [...new Set(phonesRaw.map((s) => s.trim().replace(/\(|\)/g, '')).filter((s) => {
    const d = s.replace(/\D/g, '')
    return d.length >= 9 && d.length <= 15 && !/^(19|20)\d{2}[-./]\d{1,2}[-./]\d{1,2}/.test(s.trim())
  }))].slice(0, 30)
  // domains: run on text with emails + ips stripped so email domains don't leak in but standalone domains survive
  const stripped = t.replace(new RegExp(EMAIL_RE.source, 'g'), ' ').replace(new RegExp(IPV4_RE.source, 'g'), ' ')
  const domains = [...new Set((stripped.match(DOMAIN_RE) || []).map((d) => d.toLowerCase().replace(/^\*\./, '')))].slice(0, 50)
  // usernames: @handle
  const usernames = [...new Set([...t.matchAll(HANDLE_RE)].map((m) => m[1].toLowerCase()))].slice(0, 30)
  return { emails, domains, ips, phones, usernames }
}
