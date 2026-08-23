import { useEffect, useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCaseFile } from '../../store/casefile'
import { KINDS } from '../../utils/kinds'

export default function QuickSearch({ onClose }) {
  const nodes = useCaseFile((s) => s.nodes)
  const select = useCaseFile((s) => s.select)
  const setCenter = useReactFlow().setCenter
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = nodes.filter((n) => n.data.label && KINDS[n.data.kind])
    if (!q) return pool.slice(0, 8)
    return pool
      .filter(
        (n) =>
          n.data.label.toLowerCase().includes(q) ||
          KINDS[n.data.kind].label.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [nodes, query])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function jump(node) {
    select(node.id)
    setCenter(node.position.x + 90, node.position.y + 40, { zoom: 1.15, duration: 420 })
    onClose()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && results[cursor]) {
      jump(results[cursor])
    }
  }

  return (
    <div className="qs-backdrop" onMouseDown={onClose}>
      <div className="qs" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="qs-input"
          value={query}
          placeholder="Jump to entity…"
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={onKeyDown}
        />
        <div className="qs-list">
          {!results.length && <p className="qs-empty">No matching entities</p>}
          {results.map((n, i) => {
            const meta = KINDS[n.data.kind]
            return (
              <button
                key={n.id}
                type="button"
                className={`qs-item ${i === cursor ? 'active' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => jump(n)}
              >
                <span className="qs-icon">{meta.icon}</span>
                <span className="qs-label">{n.data.label}</span>
                <span className="qs-kind">{meta.label}</span>
              </button>
            )
          })}
        </div>
        <div className="qs-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
