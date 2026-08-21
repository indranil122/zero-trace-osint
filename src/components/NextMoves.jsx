import { useMemo, useState } from 'react'
import { useCaseFile } from '../store/casefile'
import { nextMoves } from '../engine/nextmoves'
import { nodeIdOf } from '../utils/kinds'
import { gravatarProbe } from '../api/gravatar'
import { useRunner } from '../engine/useRunner'

export default function NextMoves() {
  const nodes = useCaseFile((s) => s.nodes)
  const [dismissed, setDismissed] = useState(() => new Set())
  const { runModule } = useRunner()

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const visible = useMemo(
    () => nextMoves(nodes).filter((m) => !dismissed.has(m.key)),
    [nodes, dismissed]
  )

  if (!visible.length) return null

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
          detail: r.found
            ? `Public avatar exists (md5 ${r.hash.slice(0, 10)}…) — mailbox likely active`
            : 'No public Gravatar avatar found',
          url: r.profileUrl,
        },
      ])
      store.pushLog(
        r.found ? `Gravatar: avatar found for ${email}` : `Gravatar: none for ${email}`,
        r.found ? 'ok' : 'info'
      )
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
      store.addFindings(null, [
        { kind: 'username', value: m.value, source: 'Next moves', detail: 'Hub created from account probe' },
      ])
      store.select(nodeIdOf('username', m.value))
    }
  }

  return (
    <section className="panel">
      <h2>Next moves</h2>
      <div className="corr-list">
        {visible.map((m) => (
          <div key={m.key} className="corr-item move-item">
            <div className="corr-pair">{m.title}</div>
            <p>{m.reason}</p>
            <div className="btn-row" style={{ marginTop: 4 }}>
              <button onClick={() => execute(m)}>Run</button>
              <button onClick={() => dismiss(m.key)}>Later</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
