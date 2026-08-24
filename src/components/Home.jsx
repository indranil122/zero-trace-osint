import { useRef, useState, lazy, Suspense, useEffect } from 'react'
import { useCaseFile } from '../store/casefile'
import ThemeToggle from './ThemeToggle'
import LegalFooter from './LegalFooter'
const LegalModal = lazy(() => import('./legal/LegalModal'))

function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function Home() {
  const index = useCaseFile((s) => s.index)
  const createCase = useCaseFile((s) => s.createCase)
  const openCase = useCaseFile((s) => s.openCase)
  const deleteCaseById = useCaseFile((s) => s.deleteCaseById)
  const importFromFile = useCaseFile((s) => s.importFromFile)
  const fileRef = useRef(null)
  const [name, setName] = useState('')
  const [legalTab, setLegalTab] = useState(null)

  useEffect(() => {
    const ids = new Set(['privacy', 'terms', 'gdpr', 'ccpa', 'data', 'ip', 'tm'])
    const sync = () => {
      try {
        const h = window.location.hash.replace(/^#/, '')
        if (ids.has(h)) setLegalTab(h)
        else if (!h) setLegalTab(null)
      } catch {}
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function create() {
    createCase(name.trim() || 'Untitled investigation')
    setName('')
  }

  return (
    <div className="home">
      <div className="home-inner">
        <div className="flex items-center justify-between gap-4">
          <div className="brand big">
            <span className="brand-mark" />
            <div>
              <h1>VeilTrace</h1>
              <p>Private OSINT Workbench · local-only case files</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="home-create">
          <input
            value={name}
            placeholder="Name a new investigation…"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button type="button" onClick={create}>New investigation</button>
          <button type="button" onClick={() => fileRef.current?.click()}>Import case / vault</button>
          <input
            ref={fileRef}
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

        <div className="case-grid">
          {!index.length && (
            <p className="dim center">
              No cases yet. Everything you store here lives only in this browser — nothing is ever uploaded.
            </p>
          )}
          {index.map((c) => (
            <div key={c.id} className="case-card" onClick={() => openCase(c.id)}>
              <div className="case-name">{c.name}</div>
              <div className="case-meta">
                {c.nodeCount} entities · updated {timeAgo(c.updatedAt)}
              </div>
              <div className="case-actions">
                <button type="button" onClick={(e) => { e.stopPropagation(); openCase(c.id) }}>Open</button>
                <button type="button"
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Delete "${c.name}" permanently? This cannot be undone.`)) {
                      deleteCaseById(c.id)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer className="privacy-note center space-y-3">
          <p>Zero server, zero accounts, zero logs. Recon queries go from this tab straight to public sources.</p>
          <LegalFooter onOpen={setLegalTab} />
        </footer>
      </div>
      {legalTab && (
        <Suspense fallback={null}><LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} /></Suspense>
      )}
    </div>
  )
}
