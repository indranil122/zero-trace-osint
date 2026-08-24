import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { marked } from 'marked'
import { useCaseFile } from '../store/casefile'
import { buildReport, buildAbuseReport, printHtml } from '../engine/report'
import { aiExecutiveSummary, getStoredKey } from '../api/ai'

export default function ReportModal({ initialMode = 'analyst', onClose }) {
  const [mode, setMode] = useState(initialMode)
  const [busy, setBusy] = useState(false)
  const caseName = useCaseFile((s) => s.caseName)
  const nodes = useCaseFile((s) => s.nodes)
  const edges = useCaseFile((s) => s.edges)
  const log = useCaseFile((s) => s.log)
  const aiNarrative = useCaseFile((s) => s.aiNarrative)

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const markdown = useMemo(() => {
    if (mode === 'abuse') return buildAbuseReport({ caseName, nodes, edges })
    return buildReport({ caseName, nodes, edges, log, aiNarrative }, mode)
  }, [caseName, nodes, edges, log, aiNarrative, mode])
  const html = useMemo(() => marked.parse(markdown), [markdown])

  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const suffix = mode === 'ctf' ? '.writeup' : mode === 'abuse' ? '.abuse-report' : '.report'
    a.download = `${(caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}${suffix}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    useCaseFile.getState().pushLog('Report downloaded as Markdown', 'ok')
  }

  function printPdf() {
    printHtml(html, caseName || 'OSINT Report')
    useCaseFile.getState().pushLog('Print dialog opened — choose "Save as PDF"', 'ok')
  }

  async function generateAiSummary() {
    const key = getStoredKey()
    if (!key) {
      useCaseFile.getState().pushLog('Set your Anthropic API key in Settings first (gear icon)', 'warn')
      return
    }
    setBusy(true)
    const tid = useCaseFile.getState().addTask('AI summary')
    try {
      const stats = {}
      for (const n of nodes) stats[n.data.kind] = (stats[n.data.kind] || 0) + 1
      const sample = nodes.map((n) => ({
        kind: n.data.kind,
        label: n.data.label,
        evidenceCount: n.data.evidence?.length || 0,
      }))
      const text = await aiExecutiveSummary({
        caseName,
        stats,
        entitiesSample: sample,
        apiKey: key,
      })
      useCaseFile.getState().setAiNarrative(text)
      useCaseFile.getState().pushLog('AI executive summary generated', 'ok')
    } catch (e) {
      useCaseFile.getState().pushLog(`AI summary failed — ${e.message}`, 'err')
    } finally {
      useCaseFile.getState().endTask(tid)
      setBusy(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal report" role="dialog" aria-modal="true" aria-label="Investigation report" onClick={(e) => e.stopPropagation()}>
        <div className="report-head">
          <div className="seg">
            <button type="button" className={mode === 'analyst' ? 'tab active' : 'tab'} onClick={() => setMode('analyst')}>
              Analyst report
            </button>
            <button type="button" className={mode === 'ctf' ? 'tab active' : 'tab'} onClick={() => setMode('ctf')}>
              CTF writeup
            </button>
            <button type="button" className={mode === 'abuse' ? 'tab active' : 'tab'} onClick={() => setMode('abuse')}>
              Abuse report
            </button>
          </div>
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="report-body">
          <div className="report-preview" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div className="report-actions">
          <button type="button" className="btn-primary" onClick={generateAiSummary} disabled={busy}>
            {busy ? 'Thinking…' : aiNarrative ? 'Regenerate AI summary' : 'Generate AI summary'}
          </button>
          <button type="button" onClick={download}>Download .md</button>
          <button type="button" onClick={printPdf}>Print / Save PDF</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
