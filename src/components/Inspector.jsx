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
  const [showAllDns, setShowAllDns] = useState(false)

  function analyzeFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      useCaseFile.getState().pushLog('That is not an image file', 'warn')
      return
    }
    if (!node.data.label || node.data.label.endsWith('…')) {
      updateSelected({ label: file.name })
    }
    // Store file reference for exposure hash (local, not persisted to IDB as blob for now — keep name for reload)
    try { updateSelected({ fileName: file.name, fileSize: file.size }) } catch {}
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
        <button type="button" className="danger" onClick={deleteSelected}>Delete</button>
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
                <button type="button" key={key} onClick={() => runModule(key, node.id, node.data.label)}>
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
        <button type="button"
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
        {(() => {
          const evidences = [...(node.data.evidence || [])].reverse()
          const isDnsEvidence = (ev) => (ev.recordType || ev.meta?.recordType) || ev.source === 'DNS-over-HTTPS'
          const isExposure = (ev) => ev.source && ev.source.includes('Exposure')
          const dnsEvs = evidences.filter(isDnsEvidence)
          const expEvs = evidences.filter(isExposure)
          const otherEvs = evidences.filter((ev) => !isDnsEvidence(ev) && !isExposure(ev))
          const visibleDns = showAllDns ? dnsEvs : dnsEvs.slice(0, 3)
          const hasMoreDns = dnsEvs.length > 3

          return (
            <>
              {expEvs.map((ev, i) => {
                const status = ev.status || ev.meta?.status || 'unknown'
                const sev = ev.severity || ev.meta?.severity || ''
                const conf = ev.confidence || ev.meta?.confidence || ''
                const bName = ev.breachName || ev.meta?.breachName || ''
                const bDate = ev.breachDate || ev.meta?.breachDate || ''
                const dClasses = ev.dataClasses || ev.meta?.dataClasses || ''
                const hash = ev.hash || ev.meta?.hash || ''
                const statusColor = status === 'confirmed' ? '#ef4444' : status === 'possible' ? '#f59e0b' : status === 'no_result' ? '#10b981' : status === 'intel' ? '#3b82f6' : '#6b7280'
                const links = ev.meta?.links || []
                return (
                  <div key={`exp-${i}`} className="ev-item" style={{ borderLeftColor: statusColor }}>
                    <div className="ev-top">
                      <strong>{ev.source}</strong>
                      <time>{timeAgo(ev.at)}</time>
                    </div>
                    {ev.detail && <p>{ev.detail}</p>}
                    <div className="dns-meta" style={{ marginTop: 6 }}>
                      <span className="dns-tag" style={{ background: statusColor, color: '#fff', border: 'none' }}>{status.replace('_', ' ')}</span>
                      {sev && <span className="dns-tag">Severity: {sev}</span>}
                      {conf && <span className="dns-tag">Confidence: {conf}</span>}
                      {bName && <span className="dns-tag">Breach: {bName}</span>}
                      {(ev.riskLabel || ev.meta?.riskLabel) && <span className="dns-tag">Risk: {ev.riskLabel || ev.meta?.riskLabel}</span>}
                      {(ev.lineType || ev.meta?.lineType) && <span className="dns-tag">Line: {ev.lineType || ev.meta?.lineType}</span>}
                      {(ev.carrier || ev.meta?.carrier) && <span className="dns-tag">Carrier: {ev.carrier || ev.meta?.carrier}</span>}
                    </div>
                    {bDate && <p className="dim" style={{ fontSize: '11px' }}>Incident: {String(bDate).slice(0, 10)}</p>}
                    {dClasses && <p className="dim" style={{ fontSize: '11px', wordBreak: 'break-word' }}>Exposed data: {String(dClasses).slice(0, 120)}</p>}
                    {hash && <p className="dim" style={{ fontSize: '11px', wordBreak: 'break-all' }}>Hash: {String(hash).slice(0, 24)}…</p>}
                    {links.length > 0 && (
                      <div className="dns-meta" style={{ marginTop: 8 }}>
                        {links.map((l) => (
                          <a
                            key={l.name}
                            className="dns-tag"
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            title={l.note || l.name}
                            style={{ textDecoration: 'none' }}
                          >
                            {l.name} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {ev.url && <a href={ev.url} target="_blank" rel="noreferrer">verify source ↗</a>}
                    <p className="dim" style={{ fontSize: '11px', marginTop: 4, fontStyle: 'italic' }}>Never shows passwords/tokens. Verify at original breach source.</p>
                  </div>
                )
              })}
              {visibleDns.map((ev, i) => {
                const rt = ev.recordType || ev.meta?.recordType
                const res = ev.resolver || ev.meta?.resolver
                const ttl = ev.ttl ?? ev.meta?.ttl
                const q = ev.query || ev.meta?.query
                const ts = ev.timestamp || ev.meta?.timestamp
                const raw = ev.raw ?? ev.meta?.raw
                const norm = ev.normalized ?? ev.meta?.normalized
                return (
                <div key={`dns-${i}`} className="ev-item dns-ev">
                  <div className="ev-top">
                    <strong>{ev.source}{rt ? ` · ${rt}` : ''}</strong>
                    <time>{timeAgo(ev.at)}</time>
                  </div>
                  {ev.detail && <p>{ev.detail}</p>}
                  <div className="dns-meta">
                    {rt && <span className="dns-tag">Type: {rt}</span>}
                    {res && <span className="dns-tag">Resolver: {res}</span>}
                    {ttl != null && <span className="dns-tag">TTL: {ttl}s</span>}
                    {q && <span className="dns-tag">Query: {q}</span>}
                  </div>
                  {ts && <p className="dim" style={{ fontSize: '11px' }}>Captured: {new Date(ts).toISOString().replace('T', ' ').slice(0, 19)}Z</p>}
                  {raw != null && Array.isArray(raw) ? (
                    <details className="dns-raw">
                      <summary>Raw ({raw.length} records)</summary>
                      <code>{raw.slice(0, 10).join(', ')}{raw.length > 10 ? '…' : ''}</code>
                    </details>
                  ) : raw != null && typeof raw === 'string' ? (
                    <p className="dim" style={{ fontSize: '11px', wordBreak: 'break-all' }}>Raw: {raw} {norm && norm !== raw ? `→ ${norm}` : ''}</p>
                  ) : null}
                  {ev.url && <a href={ev.url} target="_blank" rel="noreferrer">open source ↗</a>}
                  <p className="dim" style={{ fontSize: '11px', marginTop: 4, fontStyle: 'italic' }}>Discovered via {res || 'DNS-over-HTTPS'} for query “{q || node.data.label}” — explains where and why this record was found.</p>
                </div>
                )
              })}
              {hasMoreDns && (
                <button type="button" className="wide" style={{ marginBottom: 8 }} onClick={() => setShowAllDns(!showAllDns)}>
                  {showAllDns ? 'Show less' : `Show all ${dnsEvs.length} DNS records (+${dnsEvs.length - 3})`}
                </button>
              )}
              {otherEvs.map((ev, i) => (
                <div key={`other-${i}`} className="ev-item">
                  <div className="ev-top">
                    <strong>{ev.source}</strong>
                    <time>{timeAgo(ev.at)}</time>
                  </div>
                  {ev.detail && <p>{ev.detail}</p>}
                  {ev.url && <a href={ev.url} target="_blank" rel="noreferrer">open source ↗</a>}
                </div>
              ))}
              {hasMoreDns && dnsEvs.length > 6 && !showAllDns && (
                <p className="dim" style={{ textAlign: 'center' }}>A/AAAA results grouped and deduplicated. Expand to see all {dnsEvs.length} records. Graph positions IPs in a tight cluster below the domain for clarity.</p>
              )}
            </>
          )
        })()}
      </section>
    </aside>
  )
}
