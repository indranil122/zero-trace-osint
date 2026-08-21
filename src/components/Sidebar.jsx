import { useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCaseFile } from '../store/casefile'
import { KINDS, normalizeValue } from '../utils/kinds'
import { encryptToVault } from '../utils/crypto'
import { useRunner } from '../engine/useRunner'
import ActivityLog from './ActivityLog'
import CorrelationPanel from './CorrelationPanel'
import NextMoves from './NextMoves'
import Settings from './Settings'
import ReportModal from './ReportModal'
import TimelineModal from './TimelineModal'

export default function Sidebar() {
  const caseName = useCaseFile((s) => s.caseName)
  const lastSavedAt = useCaseFile((s) => s.lastSavedAt)
  const setCaseName = useCaseFile((s) => s.setCaseName)
  const addNode = useCaseFile((s) => s.addNode)
  const closeCase = useCaseFile((s) => s.closeCase)
  const exportJson = useCaseFile((s) => s.exportJson)
  const importFromFile = useCaseFile((s) => s.importFromFile)
  const selectedNodeId = useCaseFile((s) => s.selectedNodeId)
  const nodes = useCaseFile((s) => s.nodes)
  const screenToFlowPosition = useReactFlow().screenToFlowPosition
  const fileInputRef = useRef(null)

  const [domainInput, setDomainInput] = useState('')
  const [handleInput, setHandleInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportMode, setReportMode] = useState(null)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const { runDomainModule, runUsernameHunt } = useRunner()

  const selected = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null
  const pivotTarget =
    selected && ['domain', 'subdomain'].includes(selected.data.kind) && selected.data.label
      ? selected.data.label
      : null

  function place() {
    const count = useCaseFile.getState().nodes.length
    const angle = count * 2.399963
    const radius = 110 + (count % 5) * 48
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
  }

  async function exportVault() {
    const pw = window.prompt('Choose a password for this vault (min 8 chars):')
    if (pw === null) return
    if (pw.length < 8) {
      alert('Password must be at least 8 characters.')
      return
    }
    try {
      const s = useCaseFile.getState()
      const vault = await encryptToVault(
        {
          format: 'zero-trace-case',
          version: 1,
          caseName: s.caseName,
          nodes: s.nodes,
          edges: s.edges,
          aiNarrative: s.aiNarrative,
          exportedAt: new Date().toISOString(),
        },
        pw
      )
      const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(s.caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}.ztvault.json`
      a.click()
      URL.revokeObjectURL(url)
      useCaseFile.getState().pushLog('Encrypted vault exported (AES-256-GCM)', 'ok')
    } catch (e) {
      alert(`Encryption failed: ${e.message}`)
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" />
        <div>
          <h1>Zero-Trace</h1>
          <p>OSINT Workbench</p>
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: -8 }}>
        <button onClick={closeCase} title="Back to all cases">← Cases</button>
        <button onClick={() => setTimelineOpen(true)} title="Chronological view">Timeline</button>
        <button className="gear-wide" title="Settings" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
      </div>

      <label className="field">
        <span>Case name</span>
        <input
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="Untitled investigation"
        />
      </label>

      <section className="panel">
        <h2>Recon · domain</h2>
        {pivotTarget && (
          <p className="recon-target">Pivoting on selected node: <strong>{pivotTarget}</strong></p>
        )}
        <label className="field">
          <input
            value={pivotTarget ? '' : domainInput}
            disabled={Boolean(pivotTarget)}
            placeholder={pivotTarget ? 'using selected node…' : 'example.com'}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runDomainModule('dns', normalizeValue('domain', domainInput))}
          />
        </label>
        <div className="btn-row">
          <button onClick={() => runDomainModule('dns', domainInput)}>DNS</button>
          <button onClick={() => runDomainModule('rdap', domainInput)}>WHOIS</button>
          <button onClick={() => runDomainModule('certs', domainInput)}>Certs</button>
          <button onClick={() => runDomainModule('wayback', domainInput)}>Archive</button>
        </div>

        <h2 style={{ marginTop: 16 }}>Recon · username</h2>
        <label className="field">
          <input
            value={handleInput}
            placeholder="jdoe"
            onChange={(e) => setHandleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runUsernameHunt(handleInput)}
          />
        </label>
        <button className="wide" onClick={() => runUsernameHunt(handleInput)}>
          Hunt across platforms
        </button>
      </section>

      <NextMoves />

      <CorrelationPanel />

      <section className="panel">
        <h2>Add entity</h2>
        <div className="add-grid">
          {Object.entries(KINDS).map(([kind, meta]) => (
            <button key={kind} className="add-btn" onClick={() => addNode(kind, place())}>
              <span>{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Report</h2>
        <div className="stack">
          <button onClick={() => setReportMode('analyst')}>Generate analyst report</button>
          <button onClick={() => setReportMode('ctf')}>Generate CTF writeup</button>
        </div>
      </section>

      <section className="panel">
        <h2>Case file</h2>
        <div className="stack">
          <button onClick={exportJson}>Export .json</button>
          <button onClick={exportVault}>Export encrypted vault</button>
          <button onClick={() => fileInputRef.current?.click()}>Import case / vault</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importFromFile(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="save-note">{lastSavedAt ? `Saved locally · ${lastSavedAt}` : 'Local-only · IndexedDB'}</p>
      </section>

      <ActivityLog />

      <footer className="privacy-note">
        Everything runs in this browser tab. No server, no logs — your queries go only to the public data sources themselves.
      </footer>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {reportMode && <ReportModal initialMode={reportMode} onClose={() => setReportMode(null)} />}
      {timelineOpen && <TimelineModal onClose={() => setTimelineOpen(false)} />}
    </aside>
  )
}
