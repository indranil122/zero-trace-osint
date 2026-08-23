import { useState } from 'react'
import { useCaseFile } from '../store/casefile'
import { findCorrelations } from '../engine/correlate'
import { aiSuggestLinks, getStoredKey } from '../api/ai'

const CONF_CLASS = { high: 'high', medium: 'med', low: 'low' }

export default function CorrelationPanel() {
  const [suggestions, setSuggestions] = useState([])
  const nodes = useCaseFile((s) => s.nodes)
  const edges = useCaseFile((s) => s.edges)
  const linkNodes = useCaseFile((s) => s.linkNodes)

  const byId = new Map(nodes.map((n) => [n.id, n]))

  function label(id) {
    const n = byId.get(id)
    return n ? n.data.label : id
  }

  function runRules() {
    const found = findCorrelations(nodes, edges)
    setSuggestions(found.map((f) => ({ ...f, source: 'rules' })))
    useCaseFile
      .getState()
      .pushLog(
        found.length ? `Rules engine: ${found.length} connection(s) suggested` : 'Rules engine: nothing new found',
        found.length ? 'ok' : 'info'
      )
  }

  async function runAi() {
    const key = getStoredKey()
    if (!key) {
      useCaseFile.getState().pushLog('Set your Anthropic API key in Settings first (gear icon)', 'warn')
      return
    }
    if (!nodes.length) {
      useCaseFile.getState().pushLog('Nothing to correlate yet', 'warn')
      return
    }
    const tid = useCaseFile.getState().addTask('AI correlation')
    useCaseFile.getState().pushLog(`AI correlation: sending ${nodes.length} entities to Claude…`)
    try {
      const entities = nodes.slice(0, 150).map((n) => ({
        id: n.id,
        kind: n.data.kind,
        label: n.data.label,
      }))
      const ai = await aiSuggestLinks(entities, key)
      setSuggestions((prev) => {
        const known = new Set(prev.map((p) => `${p.aId}|${p.bId}`))
        return [...ai.filter((x) => !known.has(`${x.aId}|${x.bId}`)).map((x) => ({ ...x, source: 'ai' })), ...prev]
      })
      useCaseFile.getState().pushLog(`AI correlation: ${ai.length} link(s) proposed`, ai.length ? 'ok' : 'info')
    } catch (e) {
      useCaseFile.getState().pushLog(`AI correlation failed — ${e.message}`, 'err')
    } finally {
      useCaseFile.getState().endTask(tid)
    }
  }

  function accept(s) {
    linkNodes(s.aId, s.bId, {
      source: s.source === 'ai' ? 'AI correlation' : 'Correlation engine',
      detail: `[${s.confidence}] ${s.reason}`,
    })
    setSuggestions((prev) => prev.filter((x) => x !== s))
    useCaseFile.getState().pushLog(`Linked: ${label(s.aId)} ⇄ ${label(s.bId)}`, 'ok')
  }

  function acceptAll() {
    suggestions.forEach(accept)
  }

  return (
    <section className="panel">
      <h2>Correlations</h2>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="button" onClick={runRules}>Find links</button>
        <button type="button" onClick={runAi}>AI pass</button>
      </div>
      {suggestions.length > 1 && (
        <button type="button" className="wide" onClick={acceptAll}>
          Accept all ({suggestions.length})
        </button>
      )}
      <div className="corr-list">
        {!suggestions.length && (
          <p className="dim">
            Rules check overlaps (shared IPs, nameservers, email domains, handle matches).
            The AI pass finds fuzzier identity links.
          </p>
        )}
        {suggestions.map((s, i) => (
          <div key={`${s.aId}-${s.bId}-${i}`} className="corr-item">
            <div className="corr-top">
              <span className={`conf ${CONF_CLASS[s.confidence] || 'low'}`}>{s.confidence}</span>
              <span className="corr-src">{s.source}</span>
            </div>
            <div className="corr-pair">
              <strong>{label(s.aId)}</strong> ⇄ <strong>{label(s.bId)}</strong>
            </div>
            <p>{s.reason}</p>
            <div className="btn-row" style={{ marginTop: 4 }}>
              <button type="button" onClick={() => accept(s)}>Link</button>
              <button type="button" onClick={() => setSuggestions((prev) => prev.filter((x) => x !== s))}>
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
