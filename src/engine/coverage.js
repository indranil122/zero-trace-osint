// Investigation Coverage — what was checked, what wasn't, and what came back empty.
// Evidence-first: derives everything from the case graph itself.

const MODULE_ROWS = [
  { id: 'dns', label: 'DNS', markers: ['DNS-over-HTTPS'] },
  { id: 'rdap', label: 'WHOIS · RDAP', markers: ['WHOIS · RDAP'] },
  { id: 'certs', label: 'Certificates (crt.sh)', markers: ['Certificate transparency'] },
  { id: 'wayback', label: 'Wayback Machine', markers: ['Wayback Machine'] },
  { id: 'gravatar', label: 'Gravatar', markers: ['Gravatar'] },
  { id: 'dorks', label: 'Dork generator', markers: ['Dork · '] },
]

const EXPOSURE_PROVIDERS = [
  { id: 'xon', label: 'XposedOrNot (email/domain breaches)', marker: 'XposedOrNot' },
  { id: 'hudson', label: 'Hudson Rock (stealer logs)', marker: 'Hudson Rock' },
  { id: 'hibp', label: 'HIBP (domain catalog / keyed fallback)', marker: 'HIBP' },
]

export const KNOWN_PLATFORMS = [
  'GitHub', 'GitLab', 'Reddit', 'npm', 'Keybase', 'HackerNews', 'ProductHunt',
  'Dev.to', 'Forem', 'Twitch', 'SoundCloud', 'Medium', 'Kaggle', 'PyPI',
  'DockerHub', 'Replit', 'VK',
].map((p) => p.toLowerCase())

function sourcesFor(nodes, predicate) {
  const hits = []
  for (const n of nodes) {
    for (const ev of n.data.evidence || []) {
      if (predicate(ev)) hits.push({ node: n, ev })
    }
  }
  return hits
}

function moduleStatus(nodes, markers) {
  const hit = sourcesFor(nodes, (ev) => markers.some((m) => String(ev.source || '').includes(m)))
  if (!hit.length) return { status: 'not-run', detail: 'Not run in this case' }
  const unavailable = hit.filter((h) => h.ev.meta?.status === 'provider_unavailable')
  if (unavailable.length === hit.length) return { status: 'unavailable', detail: `Attempted — all ${hit.length} attempt(s) unavailable` }
  const targets = [...new Set(hit.map((h) => h.node.data.label))]
  return { status: 'checked', detail: `${targets.length} target(s): ${targets.slice(0, 3).join(', ')}${targets.length > 3 ? '…' : ''}` }
}

export function computeCoverage(nodes) {
  const rows = []

  for (const m of MODULE_ROWS) {
    rows.push({ id: m.id, label: m.label, ...moduleStatus(nodes, m.markers) })
  }

  // Exposure providers
  for (const p of EXPOSURE_PROVIDERS) {
    const hit = sourcesFor(nodes, (ev) => String(ev.source || '').includes('Exposure') && String(ev.source || '').includes(p.marker))
    let entry
    if (!hit.length) entry = { status: 'not-run', detail: 'No exposure check run for a matching target' }
    else {
      const statuses = hit.map((h) => h.ev.meta?.status).filter(Boolean)
      const unavailable = statuses.filter((s) => s === 'provider_unavailable').length
      const confirmed = statuses.filter((s) => s === 'confirmed').length
      const none = statuses.filter((s) => s === 'no_result').length
      if (unavailable && !confirmed && !none) entry = { status: 'unavailable', detail: `${unavailable} check(s) blocked — not a clean result` }
      else entry = { status: 'checked', detail: `${statuses.length} check(s) — ${confirmed} confirmed, ${none} no-result${unavailable ? `, ${unavailable} unavailable` : ''}` }
    }
    rows.push({ id: `exp-${p.id}`, label: p.label, ...entry })
  }

  // Username platform probes — from meta.platformProbe evidence on username hubs
  const probes = sourcesFor(nodes, (ev) => ev.meta?.platformProbe)
  const byPlatform = new Map()
  for (const { ev } of probes) {
    const plat = String(ev.meta.platform || '').toLowerCase()
    const prev = byPlatform.get(plat)
    // best status wins: found > inconclusive > not-found
    const rank = (f) => (f === true ? 3 : f === null ? 2 : f === 'blocked' ? 1 : 0)
    if (!prev || rank(ev.meta.found) > rank(prev.found)) byPlatform.set(plat, { found: ev.meta.found, handles: new Set([...(prev?.handles || []), ev.meta.handle]) })
    else prev.handles.add(ev.meta.handle)
  }
  const foundPlats = [...byPlatform.entries()].filter(([, v]) => v.found === true)
  const nonePlats = [...byPlatform.entries()].filter(([, v]) => v.found === false)
  const incPlats = [...byPlatform.entries()].filter(([, v]) => v.found !== true && v.found !== false)
  rows.push({
    id: 'usernames',
    label: 'Username platforms',
    status: byPlatform.size ? 'checked' : 'not-run',
    detail: byPlatform.size
      ? `${foundPlats.length} confirmed · ${nonePlats.length} not-found · ${incPlats.length} inconclusive (of ${KNOWN_PLATFORMS.length} supported)`
      : 'No username hunt run',
  })

  // Reverse image is manual-only
  const images = nodes.filter((n) => n.data.kind === 'image')
  rows.push({
    id: 'reverse-image',
    label: 'Reverse image (manual shortcuts only)',
    status: 'manual',
    detail: images.length ? `${images.length} image(s) — upload manually to Lens/Yandex/TinEye/Bing; VeilTrace does not auto-search` : 'No images in case',
  })

  const checkedCount = rows.filter((r) => r.status === 'checked').length
  const unavailableCount = rows.filter((r) => r.status === 'unavailable').length

  return {
    rows,
    summary: {
      modulesChecked: checkedCount,
      modulesUnavailable: unavailableCount,
      totalRows: rows.length,
      platformsProbed: byPlatform.size,
      platformsFound: foundPlats.length,
      platformsNone: nonePlats.length,
      platformsInconclusive: incPlats.length,
      platformTotal: KNOWN_PLATFORMS.length,
      negativeEvidence: nonePlats.flatMap(([plat, v]) => ({ platform: plat, handles: [...v.handles] })),
    },
  }
}

export function coverageSentence(cov) {
  const s = cov.summary
  return `${s.modulesChecked}/${s.totalRows} source groups checked${s.modulesUnavailable ? `, ${s.modulesUnavailable} unavailable` : ''}; username platforms ${s.platformsFound} confirmed / ${s.platformsNone} not-found / ${s.platformsInconclusive} inconclusive of ${s.platformTotal}.`
}
