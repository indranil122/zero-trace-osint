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
  {
    name: 'HackerNews',
    profile: (h) => `https://news.ycombinator.com/user?id=${h}`,
    check: async (h) => {
      const v = await getJson(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(h)}.json`)
      return v && typeof v === 'object' && v.id ? true : v === null ? false : null
    },
  },
  {
    name: 'ProductHunt',
    profile: (h) => `https://www.producthunt.com/@${h}`,
    check: (h) => statusCheck(`https://www.producthunt.com/@${encodeURIComponent(h)}`),
  },
  {
    name: 'Dev.to',
    profile: (h) => `https://dev.to/${h}`,
    check: (h) => statusCheck(`https://dev.to/api/users/by_username?url=${encodeURIComponent(h)}`),
  },
  {
    name: 'Forem',
    profile: (h) => `https://forem.com/${h}`,
    check: (h) => statusCheck(`https://forem.com/api/users/by_username?url=${encodeURIComponent(h)}`),
  },
  {
    name: 'Twitch',
    profile: (h) => `https://www.twitch.tv/${h}`,
    check: (h) => statusCheck(`https://www.twitch.tv/${encodeURIComponent(h)}`),
  },
  {
    name: 'SoundCloud',
    profile: (h) => `https://soundcloud.com/${h}`,
    check: (h) => statusCheck(`https://soundcloud.com/${encodeURIComponent(h)}`),
  },
  {
    name: 'Medium',
    profile: (h) => `https://medium.com/@${h}`,
    check: (h) => statusCheck(`https://medium.com/@${encodeURIComponent(h)}`),
  },
  {
    name: 'Kaggle',
    profile: (h) => `https://www.kaggle.com/${h}`,
    check: (h) => statusCheck(`https://www.kaggle.com/${encodeURIComponent(h)}`),
  },
  {
    name: 'PyPI',
    profile: (h) => `https://pypi.org/user/${h}/`,
    check: (h) => statusCheck(`https://pypi.org/user/${encodeURIComponent(h)}/`),
  },
  {
    name: 'DockerHub',
    profile: (h) => `https://hub.docker.com/u/${h}`,
    check: (h) => statusCheck(`https://hub.docker.com/v2/users/${encodeURIComponent(h)}/`),
  },
  {
    name: 'Replit',
    profile: (h) => `https://replit.com/@${h}`,
    check: (h) => statusCheck(`https://replit.com/@${encodeURIComponent(h)}`),
  },
  {
    name: 'VK',
    profile: (h) => `https://vk.com/${h}`,
    check: (h) => statusCheck(`https://vk.com/${encodeURIComponent(h)}`),
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
