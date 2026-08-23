import { useEffect, useState } from 'react'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useCaseFile } from '../../store/casefile'
import QuickSearch from './QuickSearch'

export default function CanvasToolbar() {
  const undo = useCaseFile((s) => s.undo)
  const redo = useCaseFile((s) => s.redo)
  const canUndo = useCaseFile((s) => s.past.length > 0)
  const canRedo = useCaseFile((s) => s.future.length > 0)
  const nodes = useCaseFile((s) => s.nodes)
  const [searchOpen, setSearchOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function exportPng() {
    const viewportEl = document.querySelector('.react-flow__viewport')
    if (!viewportEl || !nodes.length) return
    setExporting(true)
    try {
      const bounds = getNodesBounds(nodes)
      const pad = 90
      const width = Math.min(2800, Math.max(640, Math.round(bounds.width + pad * 2)))
      const height = Math.min(2000, Math.max(480, Math.round(bounds.height + pad * 2)))
      const viewport = getViewportForBounds(bounds, width, height, 0.4, 2, pad / Math.min(width, height) * 2)
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#fafafa',
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${(useCaseFile.getState().caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}-graph.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      useCaseFile.getState().pushLog(`Graph exported as PNG (${width}×${height})`, 'ok')
    } catch (e) {
      useCaseFile.getState().pushLog(`PNG export failed — ${e.message}`, 'err')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="canvas-toolbar">
      <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</button>
      <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↪</button>
      <span className="toolbar-sep" />
      <button type="button" onClick={() => setSearchOpen(true)} title="Quick search (Ctrl+K)">⌕</button>
      <button type="button" onClick={exportPng} disabled={!nodes.length || exporting} title="Export graph as PNG">
        {exporting ? '…' : 'PNG'}
      </button>
      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
