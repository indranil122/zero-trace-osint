import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'
import { saveCase, loadAllCases, deleteStoredCase } from './storage'
import { normalizeValue, nodeIdOf } from '../utils/kinds'
import { decryptFromVault } from '../utils/crypto'

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
  const idx = nodes.indexOf(node)
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
  lastSavedAt: null,

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
      selectedNodeId: null,
      tasks: [],
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
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
    if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) {
      get().scheduleSave()
    }
  },

  onNodeDragStop() {
    get().scheduleSave()
  },

  onEdgesChange(changes) {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
    if (changes.some((c) => c.type === 'remove')) get().scheduleSave()
  },

  onConnect(connection) {
    set((s) => ({
      edges: addEdge({ ...connection, animated: false, style: { stroke: '#3b4a63' } }, s.edges),
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
    set((state) => {
      if (!state.activeId || !Array.isArray(findings) || !findings.length) return {}
      const nodes = [...state.nodes]
      const edges = [...state.edges]
      const byId = new Map(nodes.map((n) => [n.id, n]))
      const edgeKeys = new Set(edges.map((e) => `${e.source}|${e.target}`))
      let parent = parentId ? byId.get(parentId) : undefined

      for (const f of findings) {
        if (!f || typeof f !== 'object') continue
        const ev = { at: Date.now(), source: f.source || 'unknown', detail: f.detail || '', url: f.url }

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
          const node = {
            id: nid,
            type: 'entity',
            position: placeAround(byId.size, parent),
            data: { kind: f.kind, label: value, notes: '', evidence: [ev] },
          }
          nodes.push(node)
          byId.set(nid, node)
        }
        if (parent && nid !== parent.id && !edgeKeys.has(`${parent.id}|${nid}`)) {
          edges.push({
            id: `e-${parent.id}-${nid}`.replace(/[^a-z0-9-|]/gi, ''),
            source: parent.id,
            target: nid,
          })
          edgeKeys.add(`${parent.id}|${nid}`)
        }
      }

      return { nodes, edges }
    })
    get().scheduleSave()
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

  exportJson() {
    const s = get()
    const payload = JSON.stringify(
      {
        format: 'zero-trace-case',
        version: 1,
        caseName: s.caseName,
        nodes: s.nodes,
        edges: s.edges,
        aiNarrative: s.aiNarrative,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(s.caseName || 'case').replace(/[^a-z0-9_-]+/gi, '_')}.zerotrace.json`
    a.click()
    URL.revokeObjectURL(url)
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
      alert('This does not look like a Zero-Trace case file.')
      return false
    }

    const id = uid()
    const rec = blankRecord(id, data.caseName || 'Imported investigation')
    rec.nodes = data.nodes
    rec.edges = Array.isArray(data.edges) ? data.edges : []
    rec.aiNarrative = typeof data.aiNarrative === 'string' ? data.aiNarrative : ''
    recordCache.set(id, rec)
    saveCase(id, rec).catch(() => {})
    set((s) => ({ index: [lightEntry(rec), ...s.index] }))
    get()._activate(id)
    useCaseFile.getState().pushLog(`Imported case "${rec.name}"`, 'ok')
    return true
  },
}))
