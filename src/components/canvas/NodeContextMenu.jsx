import { useEffect, useRef } from 'react'
import { useCaseFile } from '../../store/casefile'
import { MODULES, useRunner } from '../../engine/useRunner'
import { kindMeta } from '../../utils/kinds'

export default function NodeContextMenu({ x, y, nodeId, onClose }) {
  const node = useCaseFile((s) => s.nodes.find((n) => n.id === nodeId))
  const deleteNode = useCaseFile((s) => s.deleteSelected)
  const select = useCaseFile((s) => s.select)
  const { runModule } = useRunner()
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!node) return null
  const meta = kindMeta(node.data.kind)

  function act(fn) {
    fn()
    onClose()
  }

  const cx = Math.min(x, window.innerWidth - 200)
  const cy = Math.min(y, window.innerHeight - 220)
  return (
    <div className="ctx" style={{ left: cx, top: cy }} ref={ref} onMouseDown={(e) => e.stopPropagation()} role="menu">
      <div className="ctx-head">
        <span>{meta.icon}</span>
        <span className="ctx-label">{node.data.label || meta.label}</span>
      </div>

      {Object.entries(MODULES)
        .filter(([, mod]) => mod.accepts.includes(node.data.kind))
        .map(([key, mod]) => (
          <button key={key} className="ctx-item" onClick={() => act(() => runModule(key, node.id, node.data.label))}>
            Run {mod.label}
          </button>
        ))}

      <div className="ctx-sep" />

      <button
        className="ctx-item"
        onClick={() =>
          act(() => {
            navigator.clipboard?.writeText(node.data.label || '')
            useCaseFile.getState().pushLog('Value copied to clipboard')
          })
        }
      >
        Copy value
      </button>
      <button
        className="ctx-item danger"
        onClick={() => act(() => { select(node.id); deleteNode() })}
      >
        Delete node
      </button>
    </div>
  )
}
