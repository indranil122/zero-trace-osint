import { useRef, useState } from 'react'
import { useCaseFile } from '../store/casefile'
import { KINDS } from '../utils/kinds'
import { useRunner, MODULES } from '../engine/useRunner'

function timeAgo(ts) {
  if (!ts) return ''
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function Inspector() {
  const selectedNodeId = useCaseFile((s) => s.selectedNodeId)
  const node = useCaseFile((s) => s.nodes.find((n) => n.id === s.selectedNodeId))
  const updateSelected = useCaseFile((s) => s.updateSelected)
  const deleteSelected = useCaseFile((s) => s.deleteSelected)
  const { runModule, runImageExif } = useRunner()
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  function analyzeFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      useCaseFile.getState().pushLog('That is not an image file', 'warn')
      return
    }
    if (!node.data.label || node.data.label.endsWith('…')) {
      updateSelected({ label: file.name })
    }
    runImageExif(node.id, file)
  }

  if (!selectedNodeId || !node) {
    return (
      <aside className="inspector empty">
        <h2>Inspector</h2>
        <p>Select a node on the canvas to view and edit its details.</p>
      </aside>
    )
  }

  const meta = KINDS[node.data.kind] || KINDS.note

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <h2>Inspector</h2>
        <button className="danger" onClick={deleteSelected}>Delete</button>
      </div>

      <div className="kind-row" style={{ '--node-accent': meta.color }}>
        <span className="entity-icon big">{meta.icon}</span>
        <select
          value={node.data.kind}
          onChange={(e) => updateSelected({ kind: e.target.value })}
        >
          {Object.entries(KINDS).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      <label className="field">
        <span>Value</span>
        <input
          autoFocus
          value={node.data.label}
          placeholder={`Enter ${meta.label.toLowerCase()}…`}
          onChange={(e) => updateSelected({ label: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={4}
          value={node.data.notes || ''}
          placeholder="Context, hypotheses, next steps…"
          onChange={(e) => updateSelected({ notes: e.target.value })}
        />
      </label>

      {(node.data.kind === 'domain' || node.data.kind === 'subdomain') && node.data.label && (
        <section className="pivot">
          <h3>Pivot from here</h3>
          <div className="btn-row">
            {Object.entries(MODULES)
              .filter(([, mod]) => mod.accepts.includes(node.data.kind))
              .map(([key, mod]) => (
                <button key={key} onClick={() => runModule(key, node.id, node.data.label)}>
                  {mod.label.split(' ')[0]}
                </button>
              ))}
          </div>
        </section>
      )}

      {node.data.kind === 'image' && (
        <section className="pivot">
          <h3>Local analysis</h3>
          <div
            className={`dropzone ${dragOver ? 'active' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              analyzeFile(e.dataTransfer.files?.[0])
            }}
          >
            {dragOver ? 'Drop to analyze' : 'Drop an image here, or click to browse'}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              analyzeFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <p className="dim">Parsed in your browser with exifr — the file never leaves your machine.</p>
        </section>
      )}

      <div className="btn-row">
        <button
          className="wide"
          onClick={() => {
            navigator.clipboard?.writeText(node.data.label || '')
            useCaseFile.getState().pushLog('Value copied to clipboard')
          }}
        >
          Copy value
        </button>
      </div>

      <section className="evidence">
        <h3>Evidence chain ({node.data.evidence?.length || 0})</h3>
        {!node.data.evidence?.length && (
          <p className="dim">No evidence yet. Recon modules will attach their source + timestamp here.</p>
        )}
        {[...(node.data.evidence || [])].reverse().map((ev, i) => (
          <div key={i} className="ev-item">
            <div className="ev-top">
              <strong>{ev.source}</strong>
              <time>{timeAgo(ev.at)}</time>
            </div>
            {ev.detail && <p>{ev.detail}</p>}
            {ev.url && (
              <a href={ev.url} target="_blank" rel="noreferrer">open source ↗</a>
            )}
          </div>
        ))}
      </section>
    </aside>
  )
}
