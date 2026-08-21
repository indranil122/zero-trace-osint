const EVIDENCE_MARKERS = {
  dns: 'DNS-over-HTTPS',
  rdap: 'WHOIS · RDAP',
  certs: 'Certificate transparency',
  wayback: 'Wayback Machine',
  gravatar: 'Gravatar',
}

function hasEvidence(node, marker) {
  return (node.data.evidence || []).some((e) => e.source && e.source.includes(marker))
}

export function nextMoves(nodes) {
  const moves = []
  const seen = new Set()
  const push = (m) => {
    if (seen.has(m.key)) return
    seen.add(m.key)
    moves.push(m)
  }

  for (const n of nodes) {
    const kind = n.data.kind
    const label = n.data.label
    if (!label) continue

    if (kind === 'domain' || kind === 'subdomain') {
      for (const moduleId of ['rdap', 'certs', 'dns', 'wayback']) {
        if (moduleId === 'rdap' && kind !== 'domain') continue
        if (!hasEvidence(n, EVIDENCE_MARKERS[moduleId])) {
          push({
            key: `${moduleId}:${n.id}`,
            nodeId: n.id,
            module: moduleId,
            title: `${moduleIdName(moduleId)} on ${label}`,
            reason: `No ${shortName(moduleId)} data recorded yet`,
          })
        }
      }
    }

    if (kind === 'email') {
      if (!hasEvidence(n, EVIDENCE_MARKERS.gravatar)) {
        push({
          key: `gravatar:${n.id}`,
          nodeId: n.id,
          action: 'gravatar',
          title: `Gravatar check for ${label}`,
          reason: 'Avatar presence hints the mailbox is actively used',
        })
      }
      const dom = label.split('@')[1]
      if (dom && !nodes.some((x) => x.data.kind === 'domain' && x.data.label === dom)) {
        push({
          key: `add-domain:${dom}`,
          action: 'add-domain',
          value: dom,
          title: `Investigate domain ${dom}`,
          reason: `Email ${label} is hosted there`,
        })
      }
    }

    if (kind === 'account') {
      const idx = label.lastIndexOf('/')
      const handle = idx >= 0 ? label.slice(idx + 1) : ''
      if (handle && !nodes.some((x) => x.data.kind === 'username' && x.data.label.toLowerCase() === handle.toLowerCase())) {
        push({
          key: `add-username:${handle.toLowerCase()}`,
          action: 'add-username',
          value: handle,
          title: `Create username hub "${handle}"`,
          reason: 'Found via account probe — pivot point for cross-platform hunts',
        })
      }
    }
  }

  return moves.slice(0, 8)
}

function moduleIdName(id) {
  return { rdap: 'WHOIS lookup', certs: 'Certificate scan', dns: 'DNS enumeration', wayback: 'Archive dig' }[id] || id
}

function shortName(id) {
  return { rdap: 'registration', certs: 'certificate', dns: 'DNS', wayback: 'archive' }[id] || id
}
