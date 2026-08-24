import { overallScore, riskLevelColor } from '../engine/scoring'
import { useCaseFile } from '../store/casefile'

export default function ScoreCard() {
  const nodes = useCaseFile((s) => s.nodes)
  const { score, label, perNode, breachCount } = overallScore(nodes)
  const color = riskLevelColor(label)

  if (!nodes.length) {
    return (
      <div className="rounded-xl border bg-card p-3">
        <p className="text-xs text-muted-foreground">No exposure yet — run an Exposure check or add findings to see risk.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Exposure score</span>
        <span className="text-xs text-muted-foreground">{perNode.length} at-risk · {breachCount} breaches</span>
      </div>
      <div className="flex items-end gap-3">
        <div className="text-3xl font-extrabold tracking-tight" style={{ color }}>{score}</div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${color}14`, color, border: `1px solid ${color}30` }}>{label}</div>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">/ 100</div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      {perNode.slice(0, 3).map((p) => (
        <div key={p.id} className="flex items-center justify-between text-xs">
          <span className="truncate font-mono">{p.nodeLabel}</span>
          <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: `${riskLevelColor(p.level)}14`, color: riskLevelColor(p.level) }}>{p.score} · {p.level}</span>
        </div>
      ))}
      {perNode.length > 3 && <p className="text-xs text-muted-foreground">+{perNode.length - 3} more</p>}
      <button type="button" className="w-full h-7 rounded-full border text-xs font-medium hover:bg-muted" onClick={() => {
        const payload = perNode.map((p) => `${p.kind}:${p.label} → ${p.score} ${p.label}`).join('\n')
        navigator.clipboard?.writeText(`VeilTrace exposure ${score}/100 ${label}\n${payload}`)
      }}>Copy score</button>
    </div>
  )
}
