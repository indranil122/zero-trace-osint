import { useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCaseFile } from '../store/casefile'
import { KINDS, normalizeValue, nodeIdOf } from '../utils/kinds'
import { encryptToVault } from '../utils/crypto'
import { useRunner } from '../engine/useRunner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import CorrelationPanel from './CorrelationPanel'
import Settings from './Settings'
import ReportModal from './ReportModal'
import TimelineModal from './TimelineModal'
import ThemeToggle from './ThemeToggle'
import LegalFooter from './LegalFooter'
import LegalModal from './legal/LegalModal'

export default function Sidebar() {
  const caseName = useCaseFile((s) => s.caseName)
  const lastSavedAt = useCaseFile((s) => s.lastSavedAt)
  const setCaseName = useCaseFile((s) => s.setCaseName)
  const addNode = useCaseFile((s) => s.addNode)
  const closeCase = useCaseFile((s) => s.closeCase)
  const createCase = useCaseFile((s) => s.createCase)
  const select = useCaseFile((s) => s.select)
  const exportJson = useCaseFile((s) => s.exportJson)
  const importFromFile = useCaseFile((s) => s.importFromFile)
  const selectedNodeId = useCaseFile((s) => s.selectedNodeId)
  const nodes = useCaseFile((s) => s.nodes)
  const screenToFlowPosition = useReactFlow().screenToFlowPosition
  const fileInputRef = useRef(null)

  const [domainInput, setDomainInput] = useState('')
  const [handleInput, setHandleInput] = useState('')
  const [exposureKind, setExposureKind] = useState('email')
  const [exposureValue, setExposureValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportMode, setReportMode] = useState(null)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [legalTab, setLegalTab] = useState(null)
  const { runDomainModule, runUsernameHunt, runModule } = useRunner()

  const selected = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null
  const pivotTarget = selected && ['domain', 'subdomain'].includes(selected.data.kind) && selected.data.label ? selected.data.label : null

  function place() {
    const count = useCaseFile.getState().nodes.length
    const angle = count * 2.399963
    const radius = 110 + (count % 5) * 48
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
  }

  function handleExposure() {
    const v = exposureValue.trim()
    if (!v) { useCaseFile.getState().pushLog('Enter a value to check exposure', 'warn'); return }
    const kind = exposureKind
    useCaseFile.getState().addFindings(null, [{ kind, value: v, source: 'Operator input', detail: 'Exposure check target — personal data, verify manually' }])
    const nodeId = nodeIdOf(kind, v)
    runModule('exposure', nodeId, v)
  }

  async function exportVault() {
    const pw = window.prompt('Choose a password for this vault (min 8 chars):')
    if (pw === null) return
    if (pw.length < 8) { alert('Password must be at least 8 characters.'); return }
    try {
      const s = useCaseFile.getState()
      const vault = await encryptToVault({ format: 'zero-trace-case', version: 1, caseName: s.caseName, nodes: s.nodes, edges: s.edges, aiNarrative: s.aiNarrative, exportedAt: new Date().toISOString() }, pw)
      const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(s.caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}.ztvault.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      useCaseFile.getState().pushLog('Encrypted vault exported (AES-256-GCM)', 'ok')
    } catch (e) { alert(`Encryption failed: ${e.message}`) }
  }

  return (
    <aside className="flex h-screen w-[320px] flex-col border-r bg-card">
      <div className="flex flex-col gap-3 border-b p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-bold tracking-tight">ZT</span>
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold tracking-tight">Zero-Trace</h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">OSINT Workbench</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 h-8 rounded-full text-xs" onClick={closeCase}>← Cases</Button>
          <Button size="sm" className="flex-1 h-8 rounded-full text-xs bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-zinc-100" onClick={() => { createCase('Untitled investigation'); setDomainInput(''); setHandleInput(''); select(null) }}>+ New</Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => setSettingsOpen(true)}>⚙</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Input value={caseName} onChange={(e) => setCaseName(e.target.value)} placeholder="Untitled investigation" className="h-8 text-sm" />
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{lastSavedAt ? `● ${lastSavedAt}` : '○ Local'}</span>
      </div>

      <Tabs defaultValue="investigate" className="flex flex-1 flex-col overflow-hidden">
        <div className="px-3 pt-3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="investigate">Investigate</TabsTrigger>
            <TabsTrigger value="build">Build</TabsTrigger>
            <TabsTrigger value="intel">Intel</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <TabsContent value="investigate" className="mt-0 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Domain</p>
                  {domainInput.trim() ? (
                    <p className="text-xs text-muted-foreground">→ <span className="font-medium text-foreground">{domainInput.trim()}</span></p>
                    ) : pivotTarget ? (
                     <p className="flex items-center gap-1 text-xs text-muted-foreground">▸ <span className="font-medium text-foreground">{pivotTarget}</span> <button type="button" onClick={() => select(null)} className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-accent">×</button></p>
                   ) : null}
                  <Input value={domainInput} placeholder={pivotTarget ? `New or pivot ${pivotTarget}` : 'example.com'} onChange={(e) => setDomainInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runDomainModule('dns', normalizeValue('domain', domainInput))} className="h-8" />
                  <div className="grid grid-cols-4 gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => runDomainModule('dns', domainInput)}>DNS</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => runDomainModule('rdap', domainInput)}>WHOIS</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => runDomainModule('certs', domainInput)}>Certs</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => runDomainModule('wayback', domainInput)}>Arch</Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Username</p>
                  <div className="flex gap-1.5">
                    <Input value={handleInput} placeholder="jdoe" onChange={(e) => setHandleInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runUsernameHunt(handleInput)} className="h-8 flex-1" />
                    <Button size="sm" className="h-8 bg-black text-white hover:bg-black/90" onClick={() => runUsernameHunt(handleInput)}>Hunt</Button>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">Tip: type new domain to branch, or leave empty to pivot on selected node.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exposure — check your own data</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">Check email, phone, username, domain, name, or image hash for public breach exposure. No passwords ever shown.</p>
                <div className="flex gap-1.5">
                  <select value={exposureKind} onChange={(e) => setExposureKind(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="username">Username</option>
                    <option value="domain">Domain</option>
                    <option value="name">Name</option>
                    <option value="image">Image hash</option>
                  </select>
                  <Input value={exposureValue} placeholder={exposureKind === 'email' ? 'you@example.com' : exposureKind === 'phone' ? '+919876543210' : exposureKind === 'domain' ? 'example.com' : 'value'} onChange={(e) => setExposureValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleExposure()} className="h-8 flex-1" />
                </div>
                <Button size="sm" className="w-full h-7 bg-black text-white hover:bg-black/90 text-xs" onClick={handleExposure}>Check exposure →</Button>
                <p className="text-[10px] leading-relaxed text-muted-foreground">Statuses: confirmed / possible / no result / intel / provider unavailable. Everything runs key-free: email + stealer logs (Hudson Rock), domain catalogs, phone intel &amp; pivots. No passwords ever shown.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="build" className="mt-0 space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add entity</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(KINDS).map(([kind, meta]) => (
                    <Button key={kind} variant="outline" size="sm" className="h-8 justify-start gap-2 text-xs" onClick={() => addNode(kind, place())}>
                      <span>{meta.icon}</span>{meta.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">Drag handles to link. Right-click for pivots.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intel" className="mt-0 space-y-4">
            <CorrelationPanel />
            <Button variant="outline" size="sm" className="w-full" onClick={() => setTimelineOpen(true)}>View Timeline →</Button>
          </TabsContent>
        </div>
      </Tabs>

      <div className="border-t bg-muted/20 p-3 space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReportMode('analyst')}>Report</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReportMode('ctf')}>CTF</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTimelineOpen(true)}>◷</Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={exportJson}>.json</Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={exportVault}>Vault</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()}>Import</Button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFromFile(f); e.target.value = '' }} />
        </div>
        <LegalFooter onOpen={setLegalTab} />
      </div>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {reportMode && <ReportModal initialMode={reportMode} onClose={() => setReportMode(null)} />}
      {timelineOpen && <TimelineModal onClose={() => setTimelineOpen(false)} />}
      {legalTab && <LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </aside>
  )
}
