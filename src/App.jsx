import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCaseFile } from './store/casefile'
import { ThemeProvider } from './lib/theme'
import FlowCanvas from './components/canvas/FlowCanvas'
import Sidebar from './components/Sidebar'
import Inspector from './components/Inspector'
import Terminal from './components/Terminal'
import Home from './components/Home'

function Workspace() {
  const isEmpty = useCaseFile((s) => s.nodes.length === 0)

  return (
    <div className="app">
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
  )
}

export default function App() {
  const ready = useCaseFile((s) => s.ready)
  const hydrate = useCaseFile((s) => s.hydrate)
  const activeId = useCaseFile((s) => s.activeId)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (!ready) {
    return <div className="boot">Unlocking local case files…</div>
  }

  return (
    <ThemeProvider>
      <ReactFlowProvider>{activeId ? <Workspace /> : <Home />}</ReactFlowProvider>
    </ThemeProvider>
  )
}
