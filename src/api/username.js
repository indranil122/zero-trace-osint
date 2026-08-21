async function statusCheck(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (r.status === 404 || r.status === 410) return false
    if (!r.ok) return null
    return true
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctl.signal })
    if (r.status === 404 || r.status === 410) return false
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const PLATFORMS = [
  {
    name: 'GitHub',
    profile: (h) => `https://github.com/${h}`,
    check: (h) => statusCheck(`https://api.github.com/users/${encodeURIComponent(h)}`),
  },
  {
    name: 'GitLab',
    profile: (h) => `https://gitlab.com/${h}`,
    check: async (h) => {
      const v = await getJson(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(h)}`)
      return Array.isArray(v) ? v.length > 0 : v === false ? false : null
    },
  },
  {
    name: 'Reddit',
    profile: (h) => `https://www.reddit.com/user/${h}`,
    check: (h) => statusCheck(`https://www.reddit.com/user/${encodeURIComponent(h)}/about.json`),
  },
  {
    name: 'npm',
    profile: (h) => `https://www.npmjs.com/~${h}`,
    check: (h) =>
      statusCheck(`https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(h)}`),
  },
  {
    name: 'Keybase',
    profile: (h) => `https://keybase.io/${h}`,
    check: async (h) => {
      const v = await getJson(
        `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(h)}`
      )
      return v && typeof v === 'object' ? Boolean(v.them) : null
    },
  },
]

export async function usernameScan(rawHandle, onResult = () => {}) {
  const handle = String(rawHandle || '').trim().replace(/^@+/, '')
  if (!handle) throw new Error('Empty handle')
  if (handle.includes('/') || handle.includes('.')) {
    throw new Error('Enter a bare username, not a URL or email')
  }

  const settled = await Promise.all(
    PLATFORMS.map(async (p) => {
      let found = null
      try {
        found = await p.check(handle)
      } catch {}
      onResult(p.name, found)
      return { platform: p.name, found, url: p.profile(handle) }
    })
  )

  const hits = settled.filter((r) => r.found)
  if (!hits.length && settled.every((r) => r.found === null)) {
    throw new Error('All platforms inconclusive — network or rate-limit issue')
  }
  return settled.map((r) => ({
    kind: 'account',
    value: `${r.platform.toLowerCase()}/${handle.toLowerCase()}`,
    source: 'Profile probe · open APIs',
    detail: r.found ? `Profile present on ${r.platform} (${r.url})` : `No ${r.platform} profile`,
    url: r.url,
    found: r.found,
  }))
}
