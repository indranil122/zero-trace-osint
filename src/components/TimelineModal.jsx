import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCaseFile } from '../store/casefile'
import { collectEvents } from '../engine/timeline'

function fmt(ts) {
  const d = new Date(ts)
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) + ' UTC' }
}

export default function TimelineModal({ onClose }) {
  const nodes = useCaseFile((s) => s.nodes)
  const select = useCaseFile((s) => s.select)
  const events = useMemo(() => collectEvents(nodes), [nodes])
  const [range, setRange] = useState(0) // 0 = all, else last N days
  const [onlyMilestones, setOnlyMilestones] = useState(false)

  const filtered = useMemo(() => {
    let ev = events
    if (onlyMilestones) ev = ev.filter((e) => e.type === 'milestone')
    if (range > 0) {
      const cutoff = Date.now() - range * 24 * 60 * 60 * 1000
      ev = ev.filter((e) => e.at >= cutoff)
    }
    return ev
  }, [events, range, onlyMilestones])

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function highlight(evs) {
    const labels = new Set(evs.map((e) => e.nodeLabel))
    const node = nodes.find((n) => labels.has(n.data.label))
    if (node) select(node.id)
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal timeline" role="dialog" aria-modal="true" aria-label="Timeline" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Timeline · {filtered.length}/{events.length} events</h2>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span>Range:</span>
            <select value={range} onChange={(e) => setRange(Number(e.target.value))} style={{ width: 'auto', padding: '4px 6px' }}>
              <option value={0}>All time</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={365}>Last year</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input type="checkbox" checked={onlyMilestones} onChange={(e) => setOnlyMilestones(e.target.checked)} />
            Milestones only
          </label>
          <button type="button" style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 8px' }} onClick={() => highlight(filtered)} disabled={!filtered.length}>Highlight on canvas →</button>
        </div>

        <div className="report-body">
          {!filtered.length && (
            <p className="dim">{events.length ? 'No events in this range.' : 'No events yet — run some recon modules and their evidence will appear here chronologically.'}</p>
          )}
          {(() => {
            const byYear = new Map()
            for (const ev of filtered) {
              const y = new Date(ev.at).getUTCFullYear()
              if (!byYear.has(y)) byYear.set(y, [])
              byYear.get(y).push(ev)
            }
            return [...byYear.entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([year, evs]) => (
                <div key={year}>
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    background: 'var(--bg-soft)', borderBottom: '1px solid var(--hairline)',
                    padding: '5px 2px', margin: '8px 0 4px',
                    fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-dim)',
                  }}>
                    {year} · {evs.length} event{evs.length === 1 ? '' : 's'}
                  </div>
                  <div className="tl-list">
                    {evs.map((ev, i) => {
                      const t = fmt(ev.at)
                      return (
                        <div key={`${ev.at}-${i}`} className={`tl-item ${ev.type}`}>
                          <div className="tl-when">
                            <span className="tl-date">{t.date}</span>
                            <span className="tl-time">{t.time}</span>
                          </div>
                          <span className={`tl-dot ${ev.type}`} />
                          <div className="tl-body">
                            <div className="tl-label">{ev.label}</div>
                            <div className="tl-node">on {ev.nodeLabel}</div>
                            {ev.url && <a href={ev.url} target="_blank" rel="noreferrer">source ↗</a>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
          })()}
        </div>
      </div>
    </div>,
    document.body
  )
}
