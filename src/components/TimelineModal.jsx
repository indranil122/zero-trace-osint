import { useMemo } from 'react'
import { useCaseFile } from '../store/casefile'
import { collectEvents } from '../engine/timeline'

function fmt(ts) {
  const d = new Date(ts)
  const iso = d.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) + ' UTC' }
}

export default function TimelineModal({ onClose }) {
  const nodes = useCaseFile((s) => s.nodes)
  const events = useMemo(() => collectEvents(nodes), [nodes])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal timeline" onClick={(e) => e.stopPropagation()}>
        <div className="report-head">
          <h2>Timeline · {events.length} events</h2>
          <button className="danger" onClick={onClose}>Close</button>
        </div>

        <div className="report-body">
          {!events.length && (
            <p className="dim">No events yet — run some recon modules and their evidence will appear here chronologically.</p>
          )}
          <div className="tl-list">
            {events.map((ev, i) => {
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
      </div>
    </div>
  )
}
