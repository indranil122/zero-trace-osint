import { useRef, useState, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCaseFile } from '../store/casefile'
import { KINDS, normalizeValue, nodeIdOf } from '../utils/kinds'
import { encryptToVault } from '../utils/crypto'
import { useRunner } from '../engine/useRunner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { lazy, Suspense } from 'react'
import CorrelationPanel from './CorrelationPanel'
import ScoreCard from './ScoreCard'
import SnapshotPanel from './SnapshotPanel'
import CoveragePanel from './CoveragePanel'
import { extractEntities } from '../utils/extract'
import { PLAYBOOKS, getCached, setCached, cacheKey } from '../engine/playbooks'
import { gravatarProbe } from '../api/gravatar'
import { dorkScan } from '../api/dorks'
import ThemeToggle from './ThemeToggle'
import LegalFooter from './LegalFooter'
const Settings = lazy(() => import('./Settings'))
const ReportModal = lazy(() => import('./ReportModal'))
const TimelineModal = lazy(() => import('./TimelineModal'))
const LegalModal = lazy(() => import('./legal/LegalModal'))

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
  const [bulkText, setBulkText] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportMode, setReportMode] = useState(null)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [legalTab, setLegalTab] = useState(null)
  const { runDomainModule, runUsernameHunt, runModule } = useRunner()

  useEffect(() => {
    const ids = new Set(['privacy', 'terms', 'gdpr', 'ccpa', 'data', 'ip', 'tm'])
    const sync = () => {
      try {
        const h = window.location.hash.replace(/^#/, '')
        if (ids.has(h)) setLegalTab(h)
        else if (!h) setLegalTab(null)
      } catch {}
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

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
    const raw = exposureValue.trim()
    if (!raw) { useCaseFile.getState().pushLog('Enter a value to check exposure', 'warn'); return }
    const kind = exposureKind
    const normalized = normalizeValue(kind, raw) || raw.trim()
    if (!normalized) { useCaseFile.getState().pushLog('Enter a valid value to check exposure', 'warn'); return }
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      useCaseFile.getState().pushLog('Enter a valid email (e.g. you@example.com)', 'warn'); return
    }
    useCaseFile.getState().addFindings(null, [{ kind, value: normalized, source: 'Operator input', detail: 'Exposure check target — personal data, verify manually' }])
    const nodeId = nodeIdOf(kind, normalized)
    runModule('exposure', nodeId, normalized)
  }

  function handleBulkExtract() {
    const text = bulkText.trim()
    if (!text) { useCaseFile.getState().pushLog('Paste text to extract', 'warn'); return }
    const { emails, domains, ips, phones, usernames } = extractEntities(text)
    const preview = { emails: emails.length, domains: domains.length, ips: ips.length, phones: phones.length, usernames: usernames.length }
    setBulkPreview(preview)
    const findings = []
    emails.forEach((v) => findings.push({ kind: 'email', value: v, source: 'Bulk extract', detail: 'Extracted from paste' }))
    domains.forEach((v) => findings.push({ kind: 'domain', value: v, source: 'Bulk extract', detail: 'Extracted from paste' }))
    ips.forEach((v) => findings.push({ kind: 'ip', value: v, source: 'Bulk extract', detail: 'Extracted from paste' }))
    phones.forEach((v) => findings.push({ kind: 'phone', value: v, source: 'Bulk extract', detail: 'Extracted from paste' }))
    usernames.forEach((v) => findings.push({ kind: 'username', value: v, source: 'Bulk extract', detail: 'Extracted from paste' }))
    if (!findings.length) { useCaseFile.getState().pushLog('No entities found in paste', 'warn'); return }
    useCaseFile.getState().addFindings(null, findings)
    useCaseFile.getState().pushLog(`Bulk extract: ${findings.length} entities (${Object.entries(preview).filter(([,c])=>c).map(([k,c])=>`${c} ${k}`).join(', ')})`, 'ok')
  }

  async function runPlaybook(id) {
    const pb = PLAYBOOKS.find((p) => p.id === id)
    if (!pb) return
    const store = useCaseFile.getState()
    const targetLabel = pb.accepts.includes(selected?.data.kind) && selected?.data.label ? selected.data.label : domainInput.trim() || handleInput.trim() || exposureValue.trim()
    const targetKind = selected?.data.kind && pb.accepts.includes(selected.data.kind) ? selected.data.kind : (pb.accepts[0] || 'domain')
    let targetId = selected && pb.accepts.includes(selected.data.kind) ? selected.id : null
    if (!targetLabel) { store.pushLog(`Playbook ${pb.label}: pick a ${pb.accepts.join('/')} or select a node`, 'warn'); return }
    // ensure the hub node exists so findings attach to it
    if (!targetId) {
      store.addFindings(null, [{ kind: targetKind, value: targetLabel, source: 'Operator input', detail: `${pb.label} target` }])
      targetId = nodeIdOf(targetKind, targetLabel)
    }
    store.pushLog(`▶ ${pb.label} on ${targetLabel} — ${pb.steps.length} steps`, 'info')
    for (const step of pb.steps) {
      const key = cacheKey(step, targetLabel)
      const cached = getCached(key)
      if (cached) {
        store.addFindings(targetId, cached)
        store.pushLog(`  ↳ ${step} (cached)`, 'ok')
        continue
      }
      if (step === 'dorks') {
        const findings = dorkScan({ kind: targetKind, value: targetLabel })
        setCached(key, step, findings)
        store.addFindings(targetId, findings)
        store.pushLog(`  ✓ ${step}`, 'ok')
      } else {
        const result = await runModule(step, targetId, targetLabel)
        if (Array.isArray(result) && result.length) setCached(key, step, result)
      }
    }
    if (pb.extra === 'gravatar' && targetKind === 'email') {
      try {
        const r = await gravatarProbe(targetLabel)
        store.addFindings(targetId, [{ kind: '@', source: 'Gravatar', detail: r.found ? `Avatar exists (md5 ${r.hash.slice(0,10)}…)` : 'No Gravatar', url: r.profileUrl }])
        store.pushLog(`  ✓ gravatar ${r.found ? 'found' : 'none'}`, r.found ? 'ok' : 'info')
      } catch {}
    }
    if (pb.extra === 'hunt' && targetKind === 'username') {
      await runUsernameHunt(targetLabel)
    }
    store.pushLog(`✓ Playbook ${pb.label} done`, 'ok')
  }

  async function exportVault() {
    const pw = window.prompt('Choose a password for this vault (min 8 chars):')
    if (pw === null) return
    if (pw.length < 8) { alert('Password must be at least 8 characters.'); return }
    try {
      const s = useCaseFile.getState()
      const vault = await encryptToVault({ format: 'veiltrace-case', version: 1, caseName: s.caseName, nodes: s.nodes, edges: s.edges, aiNarrative: s.aiNarrative, exportedAt: new Date().toISOString() }, pw)
      const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(s.caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}.vtvault.json`
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
            <span className="text-sm font-bold tracking-tight">VT</span>
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold tracking-tight">VeilTrace</h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Private Workbench</p>
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
                  <Input value={exposureValue} placeholder={exposureKind === 'email' ? 'you@example.com' : exposureKind === 'phone' ? '+919876543210' : exposureKind === 'domain' ? 'example.com' : exposureKind === 'image' ? 'sha256 hash…' : exposureKind === 'name' ? 'John Doe' : 'value'} onChange={(e) => setExposureValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleExposure()} className="h-8 flex-1" />
                </div>
                <Button size="sm" className="w-full h-7 bg-black text-white hover:bg-black/90 text-xs" onClick={handleExposure}>Check exposure →</Button>
                <p className="text-[10px] leading-relaxed text-muted-foreground">Statuses: confirmed / possible / no result / intel / provider unavailable. Everything runs key-free: email + stealer logs (Hudson Rock), domain catalogs, phone intel &amp; pivots. No passwords ever shown.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bulk extract — paste inbox</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">Paste text, logs, or CSV. Extracts emails, domains, IPs, phones, @usernames locally.</p>
                <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Paste here — e.g. logs with alice@example.com, 1.1.1.1, +919876543210, @jdoe, example.com ..." rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs" />
                {bulkPreview && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(bulkPreview).filter(([,c])=>c).map(([k,c]) => (
                      <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{c} {k}</span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { const e = extractEntities(bulkText); setBulkPreview({ emails:e.emails.length, domains:e.domains.length, ips:e.ips.length, phones:e.phones.length, usernames:e.usernames.length }) }}>Preview</Button>
                  <Button size="sm" className="h-7 bg-black text-white hover:bg-black/90 text-xs" onClick={handleBulkExtract}>Extract & add →</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Playbooks — one-click workflows</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">Runs ordered steps with shared cache (6–60m) and skip-private-IP. Uses selected node or typed input.</p>
                <div className="grid gap-1.5">
                  {[
                    { id:'domain-full', label:'Domain Full', desc:'DNS + WHOIS + Certs + Wayback' },
                    { id:'email-full', label:'Email Full', desc:'Exposure + Gravatar + Dorks' },
                    { id:'phone-full', label:'Phone Full', desc:'Exposure + Dorks' },
                    { id:'username-full', label:'Username Full', desc:'Hunt 18 + Exposure + Dorks' },
                  ].map((p) => (
                    <button key={p.id} type="button" onClick={() => runPlaybook(p.id)} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-left hover:bg-muted transition">
                      <span>
                        <span className="block text-xs font-semibold">{p.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{p.desc}</span>
                      </span>
                      <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">▶</span>
                    </button>
                  ))}
                </div>
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
            <ScoreCard />
            <CoveragePanel />
            <SnapshotPanel />
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

      {settingsOpen && (
        <Suspense fallback={null}><Settings onClose={() => setSettingsOpen(false)} /></Suspense>
      )}
      {reportMode && (
        <Suspense fallback={null}><ReportModal initialMode={reportMode} onClose={() => setReportMode(null)} /></Suspense>
      )}
      {timelineOpen && (
        <Suspense fallback={null}><TimelineModal onClose={() => setTimelineOpen(false)} /></Suspense>
      )}
      {legalTab && (
        <Suspense fallback={null}><LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} /></Suspense>
      )}
    </aside>
  )
}
