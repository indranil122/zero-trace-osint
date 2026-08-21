function pushEvent(events, at, type, label, nodeLabel, url) {
  if (!at || !Number.isFinite(at)) return
  events.push({ at, type, label, nodeLabel, url })
}

export function collectEvents(nodes) {
  const events = []

  for (const n of nodes) {
    const nodeLabel = n.data.label
    for (const ev of n.data.evidence || []) {
      pushEvent(events, ev.at, 'scan', `${ev.source}${ev.detail ? ` — ${ev.detail}` : ''}`, nodeLabel, ev.url)

      const reg = String(ev.detail || '').match(/(Registered|Expires|Last changed|Transferred): (\d{4}-\d{2}-\d{2})/)
      if (reg) {
        pushEvent(
          events,
          new Date(`${reg[2]}T12:00:00Z`).getTime(),
          'milestone',
          `${reg[1]} — ${nodeLabel}`,
          nodeLabel,
          ev.url
        )
      }

      const cap = String(ev.detail || '').match(/Captured: (\d{4}-\d{2}-\d{2})/)
      if (cap) {
        pushEvent(
          events,
          new Date(`${cap[1]}T12:00:00Z`).getTime(),
          'milestone',
          `Photo captured — ${nodeLabel}`,
          nodeLabel,
          ev.url
        )
      }
    }
  }

  return events.sort((a, b) => b.at - a.at)
}
