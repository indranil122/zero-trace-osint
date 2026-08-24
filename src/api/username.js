async function statusCheck(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 12000)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (r.status === 403 || r.status === 401 || r.status === 429) return 'blocked'
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
    if (r.status === 403 || r.status === 401 || r.status === 429) return 'blocked'
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
    method: 'api-status', confidence: 'high', why: 'GitHub REST API returns 200 only for existing users',
  },
  {
    name: 'GitLab',
    profile: (h) => `https://gitlab.com/${h}`,
    check: async (h) => {
      const v = await getJson(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(h)}`)
      return Array.isArray(v) ? v.length > 0 : v
    },
    method: 'api-json', confidence: 'high', why: 'GitLab API exact-username lookup',
  },
  {
    name: 'Reddit',
    profile: (h) => `https://www.reddit.com/user/${h}`,
    check: (h) => statusCheck(`https://www.reddit.com/user/${encodeURIComponent(h)}/about.json`),
    method: 'api-status', confidence: 'high', why: 'Reddit about.json responds 404 for missing users',
  },
  {
    name: 'npm',
    profile: (h) => `https://www.npmjs.com/~${h}`,
    check: (h) =>
      statusCheck(`https://registry.npmjs.org/-/user/org.couchdb.user:${encodeURIComponent(h)}`),
    method: 'api-status', confidence: 'high', why: 'npm registry user document lookup',
  },
  {
    name: 'Keybase',
    profile: (h) => `https://keybase.io/${h}`,
    check: async (h) => {
      const v = await getJson(
        `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(h)}`
      )
      if (v && typeof v === 'object') return Boolean(v.them)
      return v
    },
    method: 'api-json', confidence: 'high', why: 'Keybase lookup API them-object presence',
  },
  {
    name: 'HackerNews',
    profile: (h) => `https://news.ycombinator.com/user?id=${h}`,
    check: async (h) => {
      const v = await getJson(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(h)}.json`)
      if (v && typeof v === 'object' && v.id) return true
      if (v === false) return false
      return v // 'blocked' | null
    },
    method: 'api-json', confidence: 'high', why: 'Firebase HN API returns null for unknown users',
  },
  {
    name: 'Dev.to',
    profile: (h) => `https://dev.to/${h}`,
    check: (h) => statusCheck(`https://dev.to/api/users/by_username?url=${encodeURIComponent(h)}`),
    method: 'api-status', confidence: 'medium', why: 'Dev.to lookup API status code',
  },
  {
    name: 'Forem',
    profile: (h) => `https://forem.com/${h}`,
    check: (h) => statusCheck(`https://forem.com/api/users/by_username?url=${encodeURIComponent(h)}`),
    method: 'api-status', confidence: 'medium', why: 'Forem lookup API status code',
  },
  {
    name: 'PyPI',
    profile: (h) => `https://pypi.org/user/${h}/`,
    check: (h) => statusCheck(`https://pypi.org/user/${encodeURIComponent(h)}/`),
    method: 'html-status', confidence: 'medium', why: 'HTTP 200 on profile page — PyPI 404s missing users reliably',
  },
  {
    name: 'DockerHub',
    profile: (h) => `https://hub.docker.com/u/${h}`,
    check: (h) => statusCheck(`https://hub.docker.com/v2/users/${encodeURIComponent(h)}/`),
    method: 'api-status', confidence: 'medium', why: 'Docker Hub v2 user endpoint status code',
  },
  {
    name: 'ProductHunt',
    profile: (h) => `https://www.producthunt.com/@${h}`,
    check: (h) => statusCheck(`https://www.producthunt.com/@${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'HTML profile page may soft-404 — verify manually',
  },
  {
    name: 'Twitch',
    profile: (h) => `https://www.twitch.tv/${h}`,
    check: (h) => statusCheck(`https://www.twitch.tv/${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'HTML page may return 200 for deactivated channels — verify manually',
  },
  {
    name: 'SoundCloud',
    profile: (h) => `https://soundcloud.com/${h}`,
    check: (h) => statusCheck(`https://soundcloud.com/${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'HTML page may soft-404 — verify manually',
  },
  {
    name: 'Medium',
    profile: (h) => `https://medium.com/@${h}`,
    check: (h) => statusCheck(`https://medium.com/@${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'Medium may serve generic page — verify manually',
  },
  {
    name: 'Kaggle',
    profile: (h) => `https://www.kaggle.com/${h}`,
    check: (h) => statusCheck(`https://www.kaggle.com/${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'SPA route always answers 200 — result is weak',
  },
  {
    name: 'Replit',
    profile: (h) => `https://replit.com/@${h}`,
    check: (h) => statusCheck(`https://replit.com/@${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'SPA route always answers 200 — result is weak',
  },
  {
    name: 'VK',
    profile: (h) => `https://vk.com/${h}`,
    check: (h) => statusCheck(`https://vk.com/${encodeURIComponent(h)}`),
    method: 'html-status', confidence: 'low', why: 'HTML page may soft-404 — verify manually',
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
      onResult(p.name, found === true ? true : found === false ? false : found === 'blocked' ? 'blocked' : null)
      return { platform: p.name, found, url: p.profile(handle), method: p.method, confidence: p.confidence, reason: p.why }
    })
  )

  const confirmed = settled.filter((r) => r.found === true)
  const blockedish = settled.filter((r) => r.found === 'blocked')
  if (!confirmed.length && !settled.some((r) => r.found === false) && settled.every((r) => r.found !== false && r.found == null)) {
    if (settled.every((r) => r.found == null || r.found === 'blocked')) {
      throw new Error(blockedish.length ? `All platforms blocked or unreachable (${blockedish.length} rate-limited) — nothing conclusive` : 'All platforms inconclusive — network or rate-limit issue')
    }
  }
  return settled.map((r) => ({
    kind: 'account',
    value: `${r.platform.toLowerCase()}/${handle.toLowerCase()}`,
    source: 'Profile probe · open APIs',
    detail:
      r.found === true
        ? `${r.platform} profile found — ${r.reason}`
        : r.found === false
          ? `No ${r.platform} profile — ${r.reason}`
          : r.found === 'blocked'
            ? `${r.platform} blocked the probe (auth/rate limit) — inconclusive`
            : `${r.platform} inconclusive (network/CORS)`,
    url: r.url,
    found: r.found,
    method: r.method,
    confidence: r.found === true ? r.confidence : r.found === false ? 'medium' : 'low',
    reason: r.reason,
  }))
}
