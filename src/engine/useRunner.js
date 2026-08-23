import { useCallback } from 'react'
import { useCaseFile } from '../store/casefile'
import { dnsScan } from '../api/dns'
import { rdapScan } from '../api/rdap'
import { crtshScan } from '../api/crtsh'
import { usernameScan } from '../api/username'
import { exifScan } from '../api/exif'
import { waybackScan } from '../api/wayback'
import { exposureScan } from '../api/exposure'

export const MODULES = {
  dns: { label: 'DNS records', accepts: ['domain', 'subdomain'], scan: (t) => dnsScan(t) },
  rdap: { label: 'WHOIS · RDAP', accepts: ['domain'], scan: (t) => rdapScan(t) },
  certs: { label: 'Certificates', accepts: ['domain', 'subdomain'], scan: (t) => crtshScan(t) },
  wayback: { label: 'Wayback Machine', accepts: ['domain', 'subdomain'], scan: (t) => waybackScan(t) },
  exposure: { label: 'Exposure check', accepts: ['email', 'phone', 'username', 'domain', 'name', 'image'], scan: (t) => exposureScan({ kind: 'email', value: t }) },
}

const imageFileByNode = new Map()

const DOMAINISH = new Set(['domain', 'subdomain'])

export function useRunner() {
  const pushLog = useCaseFile((s) => s.pushLog)
  const addTask = useCaseFile((s) => s.addTask)
  const endTask = useCaseFile((s) => s.endTask)

  const runModule = useCallback(
    async (moduleKey, parentNodeId, targetLabel) => {
      const mod = MODULES[moduleKey]
      const store = useCaseFile.getState()
      const parent = parentNodeId ? store.nodes.find((n) => n.id === parentNodeId) : null
      const kind = parent ? parent.data.kind : 'domain'
      if (!mod || !targetLabel) return false
      if (!mod.accepts.includes(kind)) {
        pushLog(`${mod.label}: not applicable to a ${kind} node`, 'warn')
        return false
      }

      const tid = addTask(mod.label)
      pushLog(`${mod.label}: scanning ${targetLabel}…`)
      try {
        const findings =
          moduleKey === 'exposure'
            ? await exposureScan({ kind, value: targetLabel, file: kind === 'image' ? (imageFileByNode.get(parentNodeId) || parent?.data?.file) : undefined })
            : await mod.scan(targetLabel)
        useCaseFile.getState().addFindings(parentNodeId, findings)
        const linked = findings.filter((f) => f.kind !== '@').length
        const meta = findings.find((f) => f.meta?.status)
        if (meta) {
          const status = meta.meta.status
          const label = status === 'confirmed' ? 'exposure confirmed' : status === 'possible' ? 'possible match' : status === 'no_result' ? 'no exposure found' : status === 'intel' ? 'intel gathered' : 'provider unavailable'
          pushLog(`${mod.label}: ${label} — ${meta.detail.slice(0, 80)}`, status === 'confirmed' ? 'warn' : status === 'provider_unavailable' ? 'warn' : 'ok')
        } else {
          pushLog(`${mod.label}: done — ${linked} linked finding(s)`, 'ok')
        }
        return true
      } catch (e) {
        pushLog(`${mod.label} failed — ${e.message}`, 'err')
        return false
      } finally {
        endTask(tid)
      }
    },
    [addTask, endTask, pushLog]
  )

  const ensureDomainTarget = useCallback(
    (rawInput) => {
      const normalized = normalizeValue('domain', String(rawInput || '').trim())
      if (!normalized) {
        useCaseFile.getState().pushLog('Type a domain first (e.g. example.com)', 'warn')
        return null
      }
      useCaseFile.getState().addFindings(null, [
        { kind: 'domain', value: normalized, source: 'Operator input', detail: 'Investigation target' },
      ])
      return `domain:${normalized}`
    },
    []
  )

  const runDomainModule = useCallback(
    (moduleKey, rawInput) => {
      const typed = String(rawInput || '').trim()
      if (typed) {
        const normalized = normalizeValue('domain', typed)
        if (!normalized) {
          useCaseFile.getState().pushLog('Type a domain first (e.g. example.com)', 'warn')
          return Promise.resolve(false)
        }
        const id = `domain:${normalized}`
        useCaseFile.getState().addFindings(null, [{ kind: 'domain', value: normalized, source: 'Operator input', detail: 'Investigation target' }])
        return runModule(moduleKey, id, normalized)
      }
      const store = useCaseFile.getState()
      const selected = store.selectedNodeId
        ? store.nodes.find((n) => n.id === store.selectedNodeId)
        : null
      if (selected && DOMAINISH.has(selected.data.kind) && selected.data.label) {
        return runModule(moduleKey, selected.id, selected.data.label)
      }
      const id = ensureDomainTarget(rawInput)
      if (!id) return Promise.resolve(false)
      return runModule(moduleKey, id, id.slice('domain:'.length))
    },
    [ensureDomainTarget, runModule]
  )

  const runUsernameHunt = useCallback(
    async (rawHandle) => {
      const handle = String(rawHandle || '').trim().replace(/^@+/, '')
      if (!handle) {
        useCaseFile.getState().pushLog('Type a username first (e.g. jdoe)', 'warn')
        return
      }
      const tid = addTask('Username hunt')
      pushLog(`Username hunt: probing platforms for @${handle}…`)
      try {
        const results = await usernameScan(handle, (platform, state) => {
          if (state === true) pushLog(`  ✓ ${platform}: profile found`, 'ok')
          else if (state === false) pushLog(`  · ${platform}: not found`)
          else pushLog(`  ? ${platform}: inconclusive`, 'warn')
        })
        const hits = results.filter((r) => r.found)
        if (hits.length) {
          const usernameId = `username:${handle.toLowerCase()}`
          useCaseFile.getState().addFindings(null, [
            { kind: 'username', value: handle, source: 'Operator input', detail: 'Search target' },
          ])
          useCaseFile.getState().addFindings(usernameId, hits)
        }
        pushLog(`Username hunt done — ${hits.length} platform(s) hit`, hits.length ? 'ok' : 'info')
      } catch (e) {
        pushLog(`Username hunt failed — ${e.message}`, 'err')
      } finally {
        endTask(tid)
      }
    },
    [addTask, endTask, pushLog]
  )

  const runImageExif = useCallback(
    async (nodeId, file) => {
      if (!nodeId || !file) return
      imageFileByNode.set(nodeId, file)
      const tid = addTask('EXIF extraction')
      pushLog(`EXIF: reading ${file.name} (${Math.round(file.size / 1024)} KB) — locally, nothing uploads…`)
      try {
        const findings = await exifScan(file)
        useCaseFile.getState().addFindings(nodeId, findings)
        const hasGps = findings.some((f) => f.kind === 'location')
        pushLog(
          hasGps ? 'EXIF: done — GPS coordinates found 📍' : 'EXIF: done — metadata extracted',
          'ok'
        )
      } catch (e) {
        pushLog(`EXIF failed on ${file.name} — ${e.message}`, 'err')
      } finally {
        endTask(tid)
      }
    },
    [addTask, endTask, pushLog]
  )

  return { runModule, runDomainModule, runUsernameHunt, runImageExif }
}
