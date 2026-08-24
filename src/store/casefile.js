import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'
import { saveCase, loadAllCases, deleteStoredCase } from './storage'
import { normalizeValue, nodeIdOf, edgeLabelFor } from '../utils/kinds'
import { decryptFromVault } from '../utils/crypto'

const HISTORY_LIMIT = 50

function labeledEdge(sourceId, targetId, sourceKind, targetKind) {
  return {
    id: `e-${encodeURIComponent(sourceId)}--${encodeURIComponent(targetId)}`,
    source: sourceId,
    target: targetId,
    label: edgeLabelFor(sourceKind, targetKind),
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
    labelStyle: { fill: '#6e6e73', fontSize: 10, fontWeight: 600 },
    style: { stroke: '#c7c7cc' },
  }
}

export const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const LAST_ACTIVE_KEY = 'zt-last-active'

let saveTimer = null
const recordCache = new Map()

function blankRecord(id, name) {
  const now = Date.now()
  return {
    id,
    name: name || 'Untitled investigation',
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    aiNarrative: '',
    log: [],
    snapshots: [],
  }
}

function lightEntry(rec) {
  return {
    id: rec.id,
    name: rec.name,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    nodeCount: (rec.nodes || []).length,
  }
}

function replaceNode(nodes, byId, node, mapData) {
  const next = { ...node, data: mapData(node.data) }
  const idx = nodes.findIndex((n) => n.id === node.id)
  if (idx >= 0) nodes[idx] = next
  byId.set(next.id, next)
  return next
}

function placeAround(i, parent) {
  const angle = i * 2.399963
  if (!parent) {
    const r = 60 + i * 9
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
  }
  const r = 200 + (i % 4) * 42
  return { x: parent.position.x + Math.cos(angle) * r, y: parent.position.y + Math.sin(angle) * r }
}

function pairKeySafe(a, b) {
  return (a < b ? `${a}~${b}` : `${b}~${a}`).replace(/[^a-zA-Z0-9~-]/g, '')
}

export const useCaseFile = create((set, get) => ({
  ready: false,
  index: [],
  activeId: null,

  caseName: '',
  nodes: [],
  edges: [],
  aiNarrative: '',
  log: [],
  tasks: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  lastSavedAt: null,
  past: [],
  future: [],
  snapshots: [],

  selectEdge(id) {
    set({ selectedEdgeId: id || null })
  },

  snapshot() {
    const { nodes, edges, past } = get()
    set({
      past: [...past.slice(-HISTORY_LIMIT + 1), { nodes, edges }],
      future: [],
    })
  },

  undo() {
    const { past, future, nodes, edges } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      past: past.slice(0, -1),
      future: [...future, { nodes, edges }],
    })
    if (get().selectedNodeId && !get().nodes.some((n) => n.id === get().selectedNodeId)) {
      set({ selectedNodeId: null })
    }
    get().scheduleSave()
  },

  redo() {
    const { past, future, nodes, edges } = get()
    if (!future.length) return
    const next = future[future.length - 1]
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes, edges }],
      future: future.slice(0, -1),
    })
    get().scheduleSave()
  },

  createSnapshot(name) {
    const { nodes, edges, snapshots } = get()
    const snap = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name || `Snapshot ${snapshots.length + 1}`,
      at: Date.now(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    }
    set({ snapshots: [...snapshots, snap] })
    get().scheduleSave()
    get().pushLog(`Snapshot created: ${snap.name} (${nodes.length} nodes)`, 'ok')
    return snap.id
  },

  deleteSnapshot(id) {
    set((s) => ({ snapshots: s.snapshots.filter((x) => x.id !== id) }))
    get().scheduleSave()
  },

  restoreSnapshot(id) {
    const snap = get().snapshots.find((s) => s.id === id)
    if (!snap) return
    get().snapshot()
    set({ nodes: JSON.parse(JSON.stringify(snap.nodes)), edges: JSON.parse(JSON.stringify(snap.edges)) })
    get().scheduleSave()
    get().pushLog(`Restored snapshot: ${snap.name}`, 'ok')
  },

  diffSnapshots(aId, bId) {
    const snaps = get().snapshots
    const a = snaps.find((s) => s.id === aId)
    const b = snaps.find((s) => s.id === bId)
    if (!a || !b) return null
    const aIds = new Set(a.nodes.map((n) => n.id))
    const bIds = new Set(b.nodes.map((n) => n.id))
    const added = b.nodes.filter((n) => !aIds.has(n.id))
    const removed = a.nodes.filter((n) => !bIds.has(n.id))
    const aEdgeKeys = new Set(a.edges.map((e) => `${e.source}|${e.target}`))
    const bEdgeKeys = new Set(b.edges.map((e) => `${e.source}|${e.target}`))
    const addedEdges = b.edges.filter((e) => !aEdgeKeys.has(`${e.source}|${e.target}`))
    const removedEdges = a.edges.filter((e) => !bEdgeKeys.has(`${e.source}|${e.target}`))
    return { added, removed, addedEdges, removedEdges, a, b }
  },

  markSaved() {
    set({ lastSavedAt: new Date().toLocaleTimeString() })
  },

  scheduleSave() {
    const { ready, activeId } = get()
    if (!ready || !activeId) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const s = get()
      const rec = recordCache.get(s.activeId) || blankRecord(s.activeId, s.caseName)
      rec.name = s.caseName
      rec.nodes = s.nodes
      rec.edges = s.edges
      rec.aiNarrative = s.aiNarrative
      rec.log = s.log
      rec.snapshots = s.snapshots || []
      rec.updatedAt = Date.now()
      recordCache.set(s.activeId, rec)
      saveCase(s.activeId, rec)
        .then(() => {
          set((st) => ({
            index: st.index.map((e) =>
              e.id === s.activeId ? { ...e, name: rec.name, updatedAt: rec.updatedAt, nodeCount: rec.nodes.length } : e
            ),
          }))
          get().markSaved()
        })
        .catch(() => {})
    }, 350)
  },

  async hydrate() {
    let entries = []
    try {
      entries = await loadAllCases()
    } catch {}

    for (const { key, record } of entries) {
      const id = record.id || String(key)
      const rec = { ...record, id }
      recordCache.set(id, rec)
    }

    const index = [...recordCache.values()]
      .map(lightEntry)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    let activeId = null
    try {
      const last = localStorage.getItem(LAST_ACTIVE_KEY)
      if (last && recordCache.has(last)) activeId = last
    } catch {}

    set({ ready: true, index, activeId })

    if (activeId) {
      const rec = recordCache.get(activeId)
      set({
        caseName: rec.name,
        nodes: rec.nodes || [],
        edges: rec.edges || [],
        aiNarrative: typeof rec.aiNarrative === 'string' ? rec.aiNarrative : '',
        log: Array.isArray(rec.log) ? rec.log : [],
        snapshots: Array.isArray(rec.snapshots) ? rec.snapshots : [],
        lastSavedAt: new Date(rec.updatedAt || Date.now()).toLocaleTimeString(),
      })
    }
  },

  _activate(id) {
    clearTimeout(saveTimer)
    const rec = recordCache.get(id)
    if (!rec) return
    try {
      localStorage.setItem(LAST_ACTIVE_KEY, id)
    } catch {}
    set({
      activeId: id,
      caseName: rec.name,
      nodes: rec.nodes || [],
      edges: rec.edges || [],
      aiNarrative: typeof rec.aiNarrative === 'string' ? rec.aiNarrative : '',
      log: Array.isArray(rec.log) ? rec.log : [],
      snapshots: Array.isArray(rec.snapshots) ? rec.snapshots : [],
      selectedNodeId: null,
      tasks: [],
      past: [],
      future: [],
      lastSavedAt: new Date(rec.updatedAt || Date.now()).toLocaleTimeString(),
    })
  },

  createCase(name) {
    const id = uid()
    const rec = blankRecord(id, name)
    recordCache.set(id, rec)
    saveCase(id, rec).catch(() => {})
    set((s) => ({ index: [lightEntry(rec), ...s.index] }))
    get()._activate(id)
    return id
  },

  openCase(id) {
    get()._activate(id)
  },

  closeCase() {
    clearTimeout(saveTimer)
    const s = get()
    if (!s.activeId) return
    const rec = recordCache.get(s.activeId)
    if (rec) {
      rec.name = s.caseName
      rec.nodes = s.nodes
      rec.edges = s.edges
      rec.aiNarrative = s.aiNarrative
      rec.log = s.log
      rec.snapshots = s.snapshots
      rec.updatedAt = Date.now()
      saveCase(s.activeId, rec).catch(() => {})
    }
    try {
      localStorage.removeItem(LAST_ACTIVE_KEY)
    } catch {}
    set({ activeId: null, selectedNodeId: null, tasks: [] })
  },

  async deleteCaseById(id) {
    clearTimeout(saveTimer)
    await deleteStoredCase(id).catch(() => {})
    recordCache.delete(id)
    const wasActive = get().activeId === id
    set((s) => ({ index: s.index.filter((e) => e.id !== id) }))
    if (wasActive) {
      try {
        localStorage.removeItem(LAST_ACTIVE_KEY)
      } catch {}
      set({ activeId: null, selectedNodeId: null, tasks: [] })
    }
  },

  setCaseName(caseName) {
    set({ caseName })
    set((s) => ({
      index: s.index.map((e) => (e.id === s.activeId ? { ...e, name: caseName } : e)),
    }))
    get().scheduleSave()
  },

  addNode(kind, position, extraData = {}) {
    get().snapshot()
    const node = {
      id: uid(),
      type: 'entity',
      position,
      data: { kind, label: '', evidence: [], notes: '', ...extraData },
    }
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: node.id }))
    get().scheduleSave()
    return node.id
  },

  onNodesChange(changes) {
    if (changes.some((c) => c.type === 'remove')) get().snapshot()
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
    if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) {
      get().scheduleSave()
    }
  },

  onNodeDragStop() {
    get().scheduleSave()
  },

  onEdgesChange(changes) {
    if (changes.some((c) => c.type === 'remove')) get().snapshot()
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
    if (changes.some((c) => c.type === 'remove')) get().scheduleSave()
  },

  onConnect(connection) {
    get().snapshot()
    set((s) => ({
      edges: addEdge({ ...connection, animated: false, style: { stroke: '#c7c7cc' } }, s.edges),
    }))
    get().scheduleSave()
  },

  select(id) {
    set({ selectedNodeId: id })
  },

  pushLog(text, level = 'info') {
    set((s) => ({ log: [{ at: Date.now(), text, level }, ...s.log].slice(0, 120) }))
    get().scheduleSave()
  },

  addTask(label) {
    const id = `task-${Math.random().toString(36).slice(2)}`
    set((s) => ({ tasks: [...s.tasks, { id, label }] }))
    return id
  },

  endTask(id) {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },

  addFindings(parentId, findings) {
    const s0 = get()
    if (!s0.activeId || !Array.isArray(findings) || !findings.length) return
    get().snapshot()
    set((state) => {
      const nodes = [...state.nodes]
      const edges = [...state.edges]
      const byId = new Map(nodes.map((n) => [n.id, n]))
      const edgeKeys = new Set(edges.map((e) => `${e.source}|${e.target}`))
      let parent = parentId ? byId.get(parentId) : undefined

      // --- collection bucketing (kipi style) ---
      const COLLECTION_THRESHOLD = 20
      const counts = {}
      for (const f of findings) if (f && f.kind && f.kind !== '@') counts[f.kind] = (counts[f.kind] || 0) + 1
      const bucketKinds = Object.entries(counts).filter(([, c]) => c >= COLLECTION_THRESHOLD).map(([k]) => k)
      const bucketed = new Set(bucketKinds)
      if (bucketKinds.length) {
        for (const kind of bucketKinds) {
          const members = findings.filter((f) => f && f.kind === kind).map((f) => normalizeValue(kind, f.value)).filter(Boolean)
          const unique = [...new Set(members)]
          if (!unique.length) continue
          const cid = `collection:${parentId || 'root'}:${kind}`
          const existing = byId.get(cid)
          const ev = {
            at: Date.now(),
            source: findings.find((f) => f.kind === kind)?.source || 'Collection',
            detail: `${unique.length} ${kind}s collected`,
            url: findings.find((f) => f.kind === kind)?.url,
          }
          if (existing) {
            const merged = [...new Set([...(existing.data.members || []), ...unique])]
            replaceNode(nodes, byId, existing, (d) => ({
              ...d,
              label: `${merged.length} ${kind}s`,
              members: merged,
              evidence: [...(d.evidence || []), ev],
            }))
          } else {
            const position = placeAround(byId.size, parent)
            const node = {
              id: cid,
              type: 'entity',
              position,
              data: { kind: 'collection', label: `${unique.length} ${kind}s`, notes: `Bucket for ${kind}`, evidence: [ev], members: unique, bucketKind: kind, parentId: parentId || null },
            }
            nodes.push(node)
            byId.set(cid, node)
            if (parent && !edgeKeys.has(`${parent.id}|${cid}`)) {
              const edge = labeledEdge(parent.id, cid, parent.data.kind, 'collection')
              edges.push(edge)
              edgeKeys.add(`${parent.id}|${cid}`)
            }
          }
        }
      }

      let dnsIpIndex = 0
      for (const f of findings) {
        if (!f || typeof f !== 'object') continue
        if (bucketed.has(f.kind)) continue
        const ev = {
          at: Date.now(),
          source: f.source || 'unknown',
          detail: f.detail || '',
          url: f.url,
          ...(f.meta ? { meta: f.meta } : {}),
        }

        if (f.kind === '@') {
          if (!parent) continue
          parent = replaceNode(nodes, byId, parent, (d) => ({
            ...d,
            evidence: [...(d.evidence || []), ev],
          }))
          continue
        }

        const value = normalizeValue(f.kind, f.value)
        if (!value) continue
        const nid = nodeIdOf(f.kind, value)
        const existing = byId.get(nid)
        if (existing) {
          replaceNode(nodes, byId, existing, (d) => ({
            ...d,
            evidence: [...(d.evidence || []), ev],
          }))
        } else {
          const isDnsIp = parent && f.meta?.recordType && ['A', 'AAAA'].includes(f.meta.recordType) && f.kind === 'ip'
          const position = isDnsIp
            ? {
                x: parent.position.x + ((dnsIpIndex % 3) - 1) * 140,
                y: parent.position.y + 160 + Math.floor(dnsIpIndex / 3) * 90,
              }
            : placeAround(byId.size, parent)
          if (isDnsIp) dnsIpIndex++
          const node = {
            id: nid,
            type: 'entity',
            position,
            data: { kind: f.kind, label: value, notes: '', evidence: [ev] },
          }
          nodes.push(node)
          byId.set(nid, node)
        }
        if (parent && nid !== parent.id && !edgeKeys.has(`${parent.id}|${nid}`)) {
          const edge = labeledEdge(parent.id, nid, parent.data.kind, f.kind)
          edges.push(edge)
          edgeKeys.add(`${parent.id}|${nid}`)
        }
      }

      return { nodes, edges }
    })
    get().scheduleSave()
  },

  expandCollection(collectionId) {
    const s = get()
    const col = s.nodes.find((n) => n.id === collectionId)
    if (!col || col.data.kind !== 'collection' || !Array.isArray(col.data.members)) return
    const kind = col.data.bucketKind || 'subdomain'
    const findings = col.data.members.map((v) => ({ kind, value: v, source: 'Expanded from collection', detail: `From ${col.data.label}` }))
    get().snapshot()
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== collectionId),
      edges: state.edges.filter((e) => e.source !== collectionId && e.target !== collectionId),
    }))
    get().addFindings(col.data.parentId || null, findings)
  },

  updateSelected(data) {
    const { selectedNodeId: id } = get()
    if (!id) return
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    }))
    get().scheduleSave()
  },

  deleteSelected() {
    const { selectedNodeId: id } = get()
    if (!id) return
    get().snapshot()
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: null,
    }))
    get().scheduleSave()
  },

  setAiNarrative(text) {
    set({ aiNarrative: String(text || '') })
    get().scheduleSave()
  },

  linkNodes(aId, bId, { source = 'Correlation engine', detail = '', url } = {}) {
    const s = get()
    if (!aId || !bId || aId === bId) return
    const a = s.nodes.find((n) => n.id === aId)
    const b = s.nodes.find((n) => n.id === bId)
    if (!a || !b) return
    get().snapshot()
    const ev = { at: Date.now(), source, detail, url }

    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === aId || n.id === bId
          ? { ...n, data: { ...n.data, evidence: [...(n.data.evidence || []), ev] } }
          : n
      )
      const keyA = `${aId}|${bId}`
      const keyB = `${bId}|${aId}`
      const exists = state.edges.some(
        (e) => `${e.source}|${e.target}` === keyA || `${e.source}|${e.target}` === keyB
      )
      let edges = state.edges
      if (!exists) {
        edges = [
          ...edges,
          {
            id: `x-${pairKeySafe(aId, bId)}`,
            source: aId,
            target: bId,
            label: 'correlated',
            labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
            labelStyle: { fill: '#7c3aed', fontSize: 10, fontWeight: 600 },
            style: { stroke: '#8b5cf6' },
            animated: true,
            data: { correlation: true, reason: detail },
          },
        ]
      }
      return { nodes, edges }
    })
    get().scheduleSave()
  },

  // also accepts legacy zero-trace-case on import
  exportJson() {
    const s = get()
    const payload = JSON.stringify(
      {
        format: 'veiltrace-case',
        version: 1,
        caseName: s.caseName,
        nodes: s.nodes,
        edges: s.edges,
        aiNarrative: s.aiNarrative,
        snapshots: s.snapshots || [],
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(s.caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}.veiltrace.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },

  async importFromFile(file) {
    let parsed
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      alert('Not a valid JSON file.')
      return false
    }

    let data = parsed
    if (parsed?.format === 'ztvault') {
      for (let attempt = 0; attempt < 3; attempt++) {
        const pw = window.prompt(attempt === 0 ? 'Vault password:' : `Wrong password (${attempt}/3) — try again:`)
        if (pw === null) return false
        try {
          data = await decryptFromVault(parsed, pw)
          break
        } catch (e) {
          if (attempt === 2) {
            alert(e.message)
            return false
          }
        }
      }
    }

    if (!data || !Array.isArray(data.nodes)) {
      alert('This does not look like a VeilTrace case file.')
      return false
    }

    const id = uid()
    const rec = blankRecord(id, data.caseName || 'Imported investigation')
    rec.nodes = data.nodes
    rec.edges = Array.isArray(data.edges) ? data.edges : []
    rec.aiNarrative = typeof data.aiNarrative === 'string' ? data.aiNarrative : ''
    rec.snapshots = Array.isArray(data.snapshots) ? data.snapshots : []
    recordCache.set(id, rec)
    saveCase(id, rec).catch(() => {})
    set((s) => ({ index: [lightEntry(rec), ...s.index] }))
    get()._activate(id)
    useCaseFile.getState().pushLog(`Imported case "${rec.name}"`, 'ok')
    return true
  },
}))
