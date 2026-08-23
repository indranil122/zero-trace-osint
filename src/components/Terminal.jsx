import { useEffect, useRef, useState, useMemo } from 'react'
import { useCaseFile } from '../store/casefile'
import { nextMoves } from '../engine/nextmoves'
import { nodeIdOf } from '../utils/kinds'
import { gravatarProbe } from '../api/gravatar'
import { useRunner } from '../engine/useRunner'

function clock(at) {
  return new Date(at).toLocaleTimeString([], { hour12: false })
}

export default function Terminal() {
  const log = useCaseFile((s) => s.log)
  const tasks = useCaseFile((s) => s.tasks)
  const nodes = useCaseFile((s) => s.nodes)
  const [dismissed, setDismissed] = useState(() => new Set())
  const { runModule } = useRunner()
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const moves = useMemo(() => nextMoves(nodes).filter((m) => !dismissed.has(m.key)), [nodes, dismissed])
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log, tasks, moves])

  function dismiss(key) {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  async function runGravatar(nodeId, email) {
    const store = useCaseFile.getState()
    const tid = store.addTask('Gravatar check')
    store.pushLog(`Gravatar: probing avatar for ${email}…`)
    try {
      const r = await gravatarProbe(email)
      store.addFindings(nodeId, [
        {
          kind: '@',
          source: 'Gravatar',
          detail: r.found ? `Public avatar exists (md5 ${r.hash.slice(0, 10)}…) — mailbox likely active` : 'No public Gravatar avatar found',
          url: r.profileUrl,
        },
      ])
      store.pushLog(r.found ? `Gravatar: avatar found for ${email}` : `Gravatar: none for ${email}`, r.found ? 'ok' : 'info')
    } catch (e) {
      store.pushLog(`Gravatar check failed — ${e.message}`, 'err')
    } finally {
      store.endTask(tid)
    }
  }

  function execute(m) {
    dismiss(m.key)
    const store = useCaseFile.getState()
    if (m.module) {
      const node = byId.get(m.nodeId)
      if (node) runModule(m.module, m.nodeId, node.data.label)
      return
    }
    if (m.action === 'gravatar') {
      runGravatar(m.nodeId, m.title.includes('for ') ? m.title.split('for ')[1] : byId.get(m.nodeId)?.data.label)
      return
    }
    if (m.action === 'add-domain') {
      store.addFindings(null, [{ kind: 'domain', value: m.value, source: 'Next moves', detail: 'Suggested pivot' }])
      store.select(nodeIdOf('domain', m.value))
      return
    }
    if (m.action === 'add-username') {
      store.addFindings(null, [{ kind: 'username', value: m.value, source: 'Next moves', detail: 'Hub created from account probe' }])
      store.select(nodeIdOf('username', m.value))
    }
  }

  return (
    <div className="terminal">
      <div className="term-head">
        <span className="term-title">● terminal — {tasks.length ? `${tasks.length} running` : 'idle'}</span>
        {tasks.length > 0 && (
          <div className="chips" style={{ margin: 0 }}>
            {tasks.map((t) => (
              <span key={t.id} className="chip">{t.label}</span>
            ))}
          </div>
        )}
      </div>

      <div className="term-body" ref={ref}>
        {moves.length > 0 && (
          <div className="term-section">
            <div className="term-label">next steps →</div>
            {moves.slice(0, 3).map((m) => (
              <div key={m.key} className="term-move">
                <span className="term-prompt">›</span>
                <span className="term-move-title">{m.title}</span>
                <span className="term-move-reason">— {m.reason}</span>
                <button type="button" className="term-btn" onClick={() => execute(m)}>run</button>
                <button type="button" className="term-btn ghost" onClick={() => dismiss(m.key)}>×</button>
              </div>
            ))}
          </div>
        )}

        {log.slice(0, 40).map((l, i) => (
          <div key={`${l.at}-${i}`} className={`term-line term-${l.level}`}>
            <span className="term-time">[{clock(l.at)}]</span>
            <span className="term-msg">{l.text}</span>
          </div>
        ))}
        {!log.length && <div className="term-line term-dim">No activity yet — run a recon module.</div>}
      </div>
    </div>
  )
}
