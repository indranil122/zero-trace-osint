import { useCaseFile } from '../store/casefile'

function clock(at) {
  return new Date(at).toLocaleTimeString([], { hour12: false })
}

export default function ActivityLog() {
  const log = useCaseFile((s) => s.log)
  const tasks = useCaseFile((s) => s.tasks)

  return (
    <section className="panel">
      <h2>Activity {tasks.length > 0 && `· ${tasks.length} running`}</h2>
      {tasks.length > 0 && (
        <div className="chips">
          {tasks.map((t) => (
            <span key={t.id} className="chip">{t.label}</span>
          ))}
        </div>
      )}
      <div className="activity">
        {!log.length && <p className="dim">Scan results and events will appear here.</p>}
        {log.map((l, i) => (
          <div key={`${l.at}-${i}`} className={`log-line log-${l.level}`}>
            <span className="log-time">{clock(l.at)}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
