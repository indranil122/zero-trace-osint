const DOMAINISH = ['domain', 'subdomain']

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function registrableBase(host) {
  const parts = String(host).split('.')
  return parts.length > 2 ? parts.slice(-2).join('.') : host
}

function parentsMap(edges) {
  const m = new Map()
  for (const e of edges) {
    if (!m.has(e.target)) m.set(e.target, [])
    m.get(e.target).push(e.source)
  }
  return m
}

export function findCorrelations(nodes, edges) {
  const suggestions = []
  const seen = new Set(edges.map((e) => pairKey(e.source, e.target)))

  const push = (aId, bId, reason, confidence) => {
    if (!aId || !bId || aId === bId) return
    const key = pairKey(aId, bId)
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push({ aId, bId, reason, confidence })
  }

  const emails = nodes.filter((n) => n.data.kind === 'email')
  const doms = nodes.filter((n) => DOMAINISH.includes(n.data.kind))
  const users = nodes.filter((n) => n.data.kind === 'username')
  const accts = nodes.filter((n) => n.data.kind === 'account')

  const domByLabel = new Map(doms.map((d) => [d.data.label, d]))

  for (const em of emails) {
    const parts = em.data.label.split('@')
    if (parts.length !== 2 || !parts[1]) continue
    const exact = domByLabel.get(parts[1])
    if (exact) {
      push(em.id, exact.id, `Email domain "${parts[1]}" matches this node`, 'high')
      continue
    }
    const base = registrableBase(parts[1])
    const baseNode = domByLabel.get(base)
    if (baseNode && base !== parts[1]) {
      push(em.id, baseNode.id, `Email hosted at ${parts[1]}, belongs to ${base}`, 'medium')
    }
  }

  for (const u of users) {
    const handle = u.data.label.toLowerCase()
    for (const a of accts) {
      const idx = a.data.label.lastIndexOf('/')
      if (idx >= 0 && a.data.label.slice(idx + 1).toLowerCase() === handle) {
        push(u.id, a.id, `Account handle equals username "${handle}"`, 'high')
      }
    }
  }

  const parentsOf = parentsMap(edges)

  const sharedInfra = (kind, fmt) => {
    const groups = new Map()
    for (const n of nodes) {
      if (n.data.kind !== kind) continue
      const key = n.data.label
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      for (const p of parentsOf.get(n.id) || []) {
        if (p !== n.id && !groups.get(key).includes(p)) groups.get(key).push(p)
      }
    }
    for (const [key, members] of groups) {
      let pairs = 0
      for (let i = 0; i < members.length && pairs < 25; i++) {
        for (let j = i + 1; j < members.length && pairs < 25; j++) {
          const na = nodes.find((n) => n.id === members[i])
          const nb = nodes.find((n) => n.id === members[j])
          if (na && nb) {
            push(members[i], members[j], fmt(key, na.data.label, nb.data.label), 'medium')
            pairs++
          }
        }
      }
    }
  }

  sharedInfra('ip', (ip, a, b) => `"${a}" and "${b}" resolve to the same IP ${ip}`)
  sharedInfra('nameserver', (ns, a, b) => `"${a}" and "${b}" share nameserver ${ns}`)

  return suggestions
}

export function graphSummary(nodes) {
  const counts = {}
  for (const n of nodes) counts[n.data.kind] = (counts[n.data.kind] || 0) + 1
  return counts
}
