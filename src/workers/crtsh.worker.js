const PROXIES = [
  (u) => u,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
]

self.onmessage = async (e) => {
  const url = e.data?.url
  if (!url) return
  for (const wrap of PROXIES) {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 20000)
      const r = await fetch(wrap(url), {
        headers: { accept: 'application/json' },
        signal: ctl.signal,
      })
      clearTimeout(timer)
      if (!r.ok) continue
      const rows = await r.json()
      self.postMessage({ ok: true, rows })
      return
    } catch {
      continue
    }
  }
  self.postMessage({ ok: false, error: 'crt.sh unreachable from all routes' })
}
