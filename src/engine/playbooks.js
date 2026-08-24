export const PLAYBOOKS = [
  {
    id: 'domain-full',
    label: 'Domain Full Recon',
    description: 'DNS + WHOIS + Certs + Wayback in parallel',
    accepts: ['domain', 'subdomain'],
    steps: ['dns', 'rdap', 'certs', 'wayback'],
  },
  {
    id: 'email-full',
    label: 'Email Full',
    description: 'Exposure + Gravatar + Dorks',
    accepts: ['email'],
    steps: ['exposure', 'dorks'],
    extra: 'gravatar',
  },
  {
    id: 'phone-full',
    label: 'Phone Full Intel',
    description: 'Exposure + Dorks + offline chips',
    accepts: ['phone'],
    steps: ['exposure', 'dorks'],
  },
  {
    id: 'username-full',
    label: 'Username Full',
    description: 'Hunt 18 + Exposure + Dorks',
    accepts: ['username'],
    steps: ['exposure', 'dorks'],
    extra: 'hunt',
  },
]

const CACHE = new Map()
const TTL_MS = {
  dns: 6 * 60 * 1000,
  rdap: 60 * 60 * 1000,
  certs: 30 * 60 * 1000,
  wayback: 30 * 60 * 1000,
  exposure: 6 * 60 * 1000,
  dorks: 60 * 60 * 1000,
}

export function getCached(key) {
  const v = CACHE.get(key)
  if (!v) return null
  if (Date.now() - v.at > (TTL_MS[v.module] || 6 * 60 * 1000)) {
    CACHE.delete(key)
    return null
  }
  return v.findings
}

export function setCached(key, module, findings) {
  CACHE.set(key, { at: Date.now(), module, findings })
}

export function cacheKey(module, target) {
  return `${module}:${String(target || '').toLowerCase().trim()}`
}
