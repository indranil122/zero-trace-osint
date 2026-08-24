import { useState } from 'react'
import { useCaseFile } from '../store/casefile'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function SnapshotPanel() {
  const snapshots = useCaseFile((s) => s.snapshots || [])
  const createSnapshot = useCaseFile((s) => s.createSnapshot)
  const restoreSnapshot = useCaseFile((s) => s.restoreSnapshot)
  const deleteSnapshot = useCaseFile((s) => s.deleteSnapshot)
  const diffSnapshots = useCaseFile((s) => s.diffSnapshots)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [diff, setDiff] = useState(null)

  function handleDiff() {
    if (!a || !b || a === b) return
    const d = diffSnapshots(a, b)
    setDiff(d)
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Snapshots & diff</p>
          <span className="text-[10px] text-muted-foreground">{snapshots.length} saved</span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">Point-in-time saves. Compare any two to see green additions, amber changes, red removals.</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" className="h-7 bg-black text-white hover:bg-black/90 text-xs" onClick={() => createSnapshot()}>Snapshot now</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { if (snapshots.length===2) { setA(snapshots[0].id); setB(snapshots[1].id) } }}>Pick 2 to diff</Button>
        </div>
        {snapshots.length > 0 && (
          <div className="space-y-1.5 max-h-36 overflow-auto">
            {snapshots.slice().reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(s.at).toLocaleString()} · {s.nodes.length} nodes</div>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="rounded-full bg-white border px-2 py-0.5 text-[10px] font-medium hover:bg-zinc-50" onClick={() => restoreSnapshot(s.id)}>Restore</button>
                  <button type="button" className="rounded-full bg-white border px-2 py-0.5 text-[10px] font-medium hover:bg-red-50 text-red-600" onClick={() => { if (window.confirm(`Delete ${s.name}?`)) deleteSnapshot(s.id) }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {snapshots.length >= 2 && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <select value={a} onChange={(e) => setA(e.target.value)} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
                <option value="">A…</option>{snapshots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={b} onChange={(e) => setB(e.target.value)} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
                <option value="">B…</option>{snapshots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={handleDiff}>Diff A↔B</Button>
            {diff && (
              <div className="rounded-lg border p-2 text-xs space-y-1">
                <div><span className="text-emerald-600 font-semibold">+{diff.added.length} added</span> · <span className="text-red-600 font-semibold">-{diff.removed.length} removed</span> · <span className="text-amber-600 font-semibold">{diff.addedEdges.length + diff.removedEdges.length} edges</span></div>
                {diff.added.slice(0,3).map((n) => <div key={n.id} className="truncate text-emerald-700">+ {n.data.kind}:{n.data.label}</div>)}
                {diff.removed.slice(0,3).map((n) => <div key={n.id} className="truncate text-red-600">- {n.data.kind}:{n.data.label}</div>)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
