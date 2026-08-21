import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCaseFile } from './store/casefile'
import FlowCanvas from './components/canvas/FlowCanvas'
import Sidebar from './components/Sidebar'
import Inspector from './components/Inspector'
import Home from './components/Home'

function Workspace() {
  const isEmpty = useCaseFile((s) => s.nodes.length === 0)

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {isEmpty && (
          <div className="empty-state">
            <h2>Start an investigation</h2>
            <p>
              Add entities from the left panel — a domain, an email, a username — then
              link them by dragging between nodes. Recon modules will fill this canvas for you.
            </p>
          </div>
        )}
        <FlowCanvas />
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

  return <ReactFlowProvider>{activeId ? <Workspace /> : <Home />}</ReactFlowProvider>
}
