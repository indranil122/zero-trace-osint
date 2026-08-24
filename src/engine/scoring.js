const SEVERITY_WEIGHT = { high: 1.0, medium: 0.6, low: 0.3, none: 0 }
const STATUS_IMPACT = {
  confirmed: 22,
  possible: 10,
  intel: 2,
  no_result: 0,
  provider_unavailable: 0,
  unknown: 0,
}

// Evidence multiplier like Flowsint
const CONFIDENCE_MULT = { high: 1.0, medium: 0.85, low: 0.65 }

function statusImpact(ev) {
  const status = ev.status || ev.meta?.status || 'unknown'
  const base = STATUS_IMPACT[status] ?? 0
  const sev = (ev.severity || ev.meta?.severity || 'none').toLowerCase()
  const w = SEVERITY_WEIGHT[sev] ?? 0
  const conf = (ev.confidence || ev.meta?.confidence || 'low').toLowerCase()
  const mult = CONFIDENCE_MULT[conf] ?? 0.65
  // For confirmed high, boost: base * (0.5 + 0.5*w) * mult  → 22*1.0*1.0=22, possible medium 10*0.8*0.85=6.8
  const sevFactor = status === 'confirmed' ? (0.5 + 0.5 * w) : (0.3 + 0.7 * w * 0.6)
  return Math.round(base * Math.max(0.35, sevFactor) * mult)
}

function providerWeight(source) {
  const s = String(source || '').toLowerCase()
  if (s.includes('hudson rock')) return 1.25 // stealer is critical
  if (s.includes('xposedornot')) return 1.0
  if (s.includes('hibp')) return 1.1
  if (s.includes('phone')) return 0.9
  return 0.9
}

export function scoreExposureForNode(node) {
  const evs = (node.data.evidence || []).filter((e) => String(e.source || '').includes('Exposure') || e.meta?.status)
  if (!evs.length) return { score: 0, label: 'none', impacts: [] }
  let raw = 0
  const impacts = []
  for (const ev of evs) {
    const base = statusImpact(ev)
    const mult = providerWeight(ev.source)
    const v = Math.round(base * mult)
    raw += v
    impacts.push({ source: ev.source, status: ev.status || ev.meta?.status, severity: ev.severity || ev.meta?.severity, confidence: ev.confidence || ev.meta?.confidence, value: v })
  }
  // cap per-node at 40 to avoid one node dominating
  raw = Math.min(40, raw)
  return { score: raw, label: bandFor(raw), impacts }
}

export function bandFor(score) {
  if (score >= 35) return 'critical'
  if (score >= 22) return 'high'
  if (score >= 10) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

export function overallScore(nodes) {
  let total = 0
  const perNode = []
  for (const n of nodes) {
    const r = scoreExposureForNode(n)
    if (r.score > 0) {
      perNode.push({ id: n.id, nodeLabel: n.data.label, kind: n.data.kind, score: r.score, level: r.label, impacts: r.impacts })
      total += r.score
    }
  }
  // Diminishing returns: total capped at 100, with sqrt-like curve
  // total = sum capped, then scale: 100 * (1 - exp(-total/45))
  const scaled = Math.min(100, Math.round(100 * (1 - Math.exp(-total / 45))))
  // also count distinct breach nodes as extra signal
  const breachCount = nodes.filter((n) => n.data.kind === 'breach').length
  const withBreaches = Math.min(100, scaled + Math.min(12, breachCount * 2))
  const finalScore = Math.min(100, withBreaches)
  const label = bandFor(finalScore)
  // recency boost: if any evidence within 30 days and confirmed, +3 (already in impacts but add note)
  return { score: finalScore, label, perNode, totalRaw: total, breachCount }
}

export function riskLevelColor(level) {
  const map = { critical: '#ef4444', high: '#f59e0b', medium: '#eab308', low: '#22c55e', none: '#6b7280' }
  return map[level] || map.none
}
