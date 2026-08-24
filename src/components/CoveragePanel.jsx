import { computeCoverage, coverageSentence } from '../engine/coverage'
import { useCaseFile } from '../store/casefile'

const CHIP = {
  checked: { bg: 'rgba(34,197,94,0.12)', fg: '#16a34a', word: 'CHECKED' },
  unavailable: { bg: 'rgba(239,68,68,0.12)', fg: '#dc2626', word: 'UNAVAILABLE' },
  manual: { bg: 'rgba(59,130,246,0.10)', fg: '#2563eb', word: 'MANUAL' },
  'not-run': { bg: 'rgba(120,120,128,0.12)', fg: '#6e6e73', word: 'NOT RUN' },
}

export default function CoveragePanel() {
  const nodes = useCaseFile((s) => s.nodes)
  const cov = computeCoverage(nodes)
  const s = cov.summary

  return (
    <section className="panel">
      <h2>Investigation coverage</h2>
      <p className="dim" style={{ marginTop: -4 }}>{coverageSentence(cov)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
        {cov.rows.map((r) => {
          const c = CHIP[r.status] || CHIP['not-run']
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span className="dns-tag" style={{ background: c.bg, color: c.fg, borderColor: `${c.fg}30`, minWidth: 86, textAlign: 'center' }}>{c.word}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
                <div className="dim" style={{ fontSize: 11 }}>{r.detail}</div>
              </div>
            </div>
          )
        })}
      </div>

      {s.negativeEvidence.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ marginBottom: 6 }}>Negative evidence — checked, not found</p>
          {s.negativeEvidence.map((n) => (
            <div key={n.platform} className="dim" style={{ fontSize: 11 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text)' }}>{n.handles.join(', ')}</span> — not on {n.platform}
            </div>
          ))}
          <p className="dim" style={{ fontSize: 10, marginTop: 6 }}>Not-found is evidence too: it narrows the footprint. Included in reports.</p>
        </div>
      )}

      <details style={{ marginTop: 12 }}>
        <summary className="dim" style={{ cursor: 'pointer', fontSize: 11 }}>Confidence legend</summary>
        <div className="dim" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6 }}>
          <strong>High</strong> — exact match via a provider API that 404s on absence (GitHub, GitLab, Reddit, npm, Keybase, HN).<br />
          <strong>Medium</strong> — structured endpoint without guaranteed absence semantics (Dev.to, PyPI, DockerHub), or single strong source.<br />
          <strong>Low</strong> — HTML status probes on SPAs/soft-404 sites (Twitch, Kaggle, Medium…), similarity-only links, or AI suggestions. Always verify.
        </div>
      </details>
    </section>
  )
}
