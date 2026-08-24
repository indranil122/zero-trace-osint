import { useEffect, useState, useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCaseFile } from './store/casefile'
import { ThemeProvider } from './lib/theme'
import FlowCanvas from './components/canvas/FlowCanvas'
import Sidebar from './components/Sidebar'
import Inspector from './components/Inspector'
import Terminal from './components/Terminal'
import Home from './components/Home'
import { MobileTopBar, MobileDock, DrawerBackdrop } from './components/mobile/MobileNav'
import LockScreen from './components/LockScreen'

function useIsMobile(bp = 1024) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= bp : false)
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${bp}px)`)
    const onChange = () => setIsMobile(m.matches)
    m.addEventListener ? m.addEventListener('change', onChange) : m.addListener(onChange)
    return () => m.removeEventListener ? m.removeEventListener('change', onChange) : m.removeListener(onChange)
  }, [bp])
  return isMobile
}

function Workspace() {
  const isEmpty = useCaseFile((s) => s.nodes.length === 0)
  const nodes = useCaseFile((s) => s.nodes)
  const log = useCaseFile((s) => s.log)
  const tasks = useCaseFile((s) => s.tasks)
  const createCase = useCaseFile((s) => s.createCase)
  const selectedNodeId = useCaseFile((s) => s.selectedNodeId)
  const isMobile = useIsMobile(1024)
  const [drawer, setDrawer] = useState('none')
  const [sheetMode, setSheetMode] = useState('peek')

  const inspectorBadge = useMemo(() => {
    const n = nodes.find((x) => x.id === selectedNodeId)
    return n?.data?.evidence?.length || 0
  }, [nodes, selectedNodeId])

  const cycleSheet = (dir) => {
    const order = ['peek', 'half', 'full']
    const idx = order.indexOf(sheetMode)
    if (dir === 'up') setSheetMode(order[Math.min(order.length - 1, idx + 1)])
    else setSheetMode(order[Math.max(0, idx - 1)])
  }

  // close drawers on route change / node select on mobile
  useEffect(() => {
    if (isMobile && selectedNodeId) {
      // optionally keep drawer open, but ensure sheet peeks
    }
  }, [selectedNodeId, isMobile])

  useEffect(() => {
    if (!isMobile) setDrawer('none')
  }, [isMobile])

  if (!isMobile) {
    return (
      <div className="app">
        <div className="desktop-only" style={{ display: 'contents' }}>
          <Sidebar />
          <main className="main">
            <div className="canvas-area">
              {isEmpty && (
                <div className="empty-state">
                  <h2>Start an investigation</h2>
                  <p>Add a domain above → run DNS/WHOIS/Certs. Everything appears as nodes you can pivot from.</p>
                </div>
              )}
              <FlowCanvas />
            </div>
            <Terminal />
          </main>
          <Inspector />
        </div>
      </div>
    )
  }

  return (
    <div className="app mobile">
      <MobileTopBar
        onMenu={() => setDrawer(drawer === 'left' ? 'none' : 'left')}
        onInspector={() => setDrawer(drawer === 'right' ? 'none' : 'right')}
        onNew={() => { createCase('Untitled investigation'); setDrawer('none') }}
        inspectorBadge={inspectorBadge}
      />

      <DrawerBackdrop open={drawer !== 'none'} onClose={() => setDrawer('none')} />

      <div className={`drawer left ${drawer === 'left' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Tools">
        <div className="drawer-head">
          <strong>Tools & Intel</strong>
          <button type="button" className="drawer-close" onClick={() => setDrawer('none')} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">
          <Sidebar />
        </div>
      </div>

      <div className={`drawer right ${drawer === 'right' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Inspector">
        <div className="drawer-head">
          <strong>Inspector</strong>
          <button type="button" className="drawer-close" onClick={() => setDrawer('none')} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">
          <Inspector />
        </div>
      </div>

      <main className="main">
        <div className="canvas-area">
          {isEmpty && (
            <div className="empty-state">
              <h2>Start an investigation</h2>
              <p>Tap Tools to add a domain → run DNS/WHOIS/Certs. Pinch to zoom, drag to pan.</p>
            </div>
          )}
          <FlowCanvas />
          <div className="canvas-vert" aria-hidden="true">
            <button type="button" onClick={() => setSheetMode(sheetMode === 'full' ? 'peek' : 'full')} title="Toggle log">≡</button>
            <button type="button" onClick={() => cycleSheet('up')} title="Expand log">▲</button>
            <button type="button" onClick={() => cycleSheet('down')} title="Collapse log">▼</button>
          </div>
        </div>

        <div className={`terminal sheet ${sheetMode}`} role="region" aria-label="Execution log">
          <div className="sheet-handle" onClick={() => cycleSheet(sheetMode === 'peek' ? 'up' : 'down')} />
          <div className="term-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="term-title">● execution — {tasks.length ? `${tasks.length} running` : `${log.length} events`}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="term-btn" onClick={() => cycleSheet('down')} aria-label="Collapse">▼</button>
              <button type="button" className="term-btn" onClick={() => cycleSheet('up')} aria-label="Expand">▲</button>
            </div>
          </div>

          {sheetMode !== 'peek' && (
            <div className="sheet-execution-table">
              <div className="sheet-table-head">
                <span>Time</span><span>Action</span><span>Status</span>
              </div>
              <div style={{ maxHeight: sheetMode === 'full' ? '34vh' : '18vh', overflowY: 'auto' }}>
                {log.slice(0, 12).map((l, i) => (
                  <div key={`${l.at}-${i}`} className="sheet-table-row">
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#6e6e8a' }}>{new Date(l.at).toLocaleTimeString([], { hour12: false })}</span>
                    <span style={{ color: '#c8c8d6', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.text.slice(0, 64)}</span>
                    <span className={`sheet-status ${l.level === 'ok' ? 'ok' : l.level === 'warn' ? 'warn' : l.level === 'err' ? 'err' : 'info'}`}>{l.level}</span>
                  </div>
                ))}
                {!log.length && <div className="sheet-table-row" style={{ color: '#6e6e8a' }}>No activity — run a recon module</div>}
              </div>
            </div>
          )}

          <div className="sheet-actions">
            <span style={{ fontSize: 10, color: '#6e6e8a', flex: 1 }}>{tasks.length ? `${tasks.length} task(s) running` : 'Idle — tap ▲ to expand'}</span>
            <button type="button" onClick={() => setDrawer('left')}>Open Tools →</button>
          </div>
        </div>
      </main>

      <MobileDock
        activeDrawer={drawer}
        onDrawer={setDrawer}
        terminalOpen={sheetMode !== 'peek'}
        onTerminal={() => setSheetMode(sheetMode === 'peek' ? 'half' : 'peek')}
        caseCount={nodes.length}
      />
    </div>
  )
}

export default function App() {
  const ready = useCaseFile((s) => s.ready)
  const hydrate = useCaseFile((s) => s.hydrate)
  const activeId = useCaseFile((s) => s.activeId)
  const [unlocked, setUnlocked] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // decide if lock is needed — always gate first start (one-time setup)
    setChecked(true)
  }, [])

  useEffect(() => {
    if (checked && unlocked) hydrate()
  }, [checked, unlocked, hydrate])

  if (!checked) return <div className="boot">Starting…</div>

  if (!unlocked) {
    return (
      <ThemeProvider>
        <LockScreen onUnlock={() => setUnlocked(true)} />
      </ThemeProvider>
    )
  }

  if (!ready) {
    return <div className="boot">Unlocking local case files…</div>
  }

  return (
    <ThemeProvider>
      <ReactFlowProvider>{activeId ? <Workspace /> : <Home />}</ReactFlowProvider>
    </ThemeProvider>
  )
}
