import { useCallback } from 'react'
import { useCaseFile } from '../store/casefile'
import { normalizeValue, nodeIdOf } from '../utils/kinds'
import { dnsScan } from '../api/dns'
import { rdapScan } from '../api/rdap'
import { crtshScan } from '../api/crtsh'
import { usernameScan } from '../api/username'
import { exifScan } from '../api/exif'
import { waybackScan } from '../api/wayback'
import { exposureScan } from '../api/exposure'
import { dorkScan } from '../api/dorks'

export const MODULES = {
  dns: { label: 'DNS records', accepts: ['domain', 'subdomain'], scan: (t) => dnsScan(t) },
  rdap: { label: 'WHOIS · RDAP', accepts: ['domain'], scan: (t) => rdapScan(t) },
  certs: { label: 'Certificates', accepts: ['domain', 'subdomain'], scan: (t) => crtshScan(t) },
  wayback: { label: 'Wayback Machine', accepts: ['domain', 'subdomain'], scan: (t) => waybackScan(t) },
  exposure: {
    label: 'Exposure check',
    accepts: ['email', 'phone', 'username', 'domain', 'name', 'image'],
    scan: (t, kind = 'email') => exposureScan({ kind, value: t }),
  },
  dorks: {
    label: 'Dork generator',
    accepts: ['domain', 'subdomain', 'email', 'username', 'phone', 'name', 'ip'],
    scan: (t, kind = 'domain') => dorkScan({ kind, value: t }),
  },
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
        let findings
        if (moduleKey === 'exposure') {
          findings = await exposureScan({ kind, value: targetLabel, file: kind === 'image' ? (imageFileByNode.get(parentNodeId) || parent?.data?.file) : undefined })
        } else if (moduleKey === 'dorks') {
          findings = await dorkScan({ kind, value: targetLabel })
        } else {
          findings = await mod.scan(targetLabel)
        }
        useCaseFile.getState().addFindings(parentNodeId, findings)
        const linked = findings.filter((f) => f.kind !== '@').length
        if (moduleKey === 'exposure') {
          // Aggregate honesty: never present partial coverage as a clean result
          const statuses = findings.map((f) => f.meta?.status).filter(Boolean)
          const uniq = {}
          for (const s of statuses) uniq[s] = (uniq[s] || 0) + 1
          const unavailable = uniq.provider_unavailable || 0
          const confirmed = uniq.confirmed || 0
          const summary = Object.entries(uniq).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(' · ')
          pushLog(
            `Exposure aggregate — ${summary}${unavailable ? ` — ⚠ ${unavailable} provider(s) unavailable: this is NOT a clean "no breach" result` : ''}`,
            unavailable ? 'warn' : confirmed ? 'warn' : 'ok'
          )
        } else {
          const meta = findings.find((f) => f.meta?.status)
          if (meta) {
            const status = meta.meta.status
            const label = status === 'confirmed' ? 'exposure confirmed' : status === 'possible' ? 'possible match' : status === 'no_result' ? 'no exposure found' : status === 'intel' ? 'intel gathered' : 'provider unavailable'
            pushLog(`${mod.label}: ${label} — ${meta.detail.slice(0, 80)}`, status === 'confirmed' ? 'warn' : status === 'provider_unavailable' ? 'warn' : 'ok')
          } else {
            pushLog(`${mod.label}: done — ${linked} linked finding(s)`, 'ok')
          }
        }
        return findings
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
          else if (state === 'blocked') pushLog(`  ⚠ ${platform}: blocked — inconclusive`, 'warn')
          else pushLog(`  ? ${platform}: inconclusive`, 'warn')
        })
        const store = useCaseFile.getState()
        // Always record the hub + every probe result as negative/positive evidence
        store.addFindings(null, [
          { kind: 'username', value: handle, source: 'Operator input', detail: 'Hunt target' },
        ])
        const hubId = nodeIdOf('username', handle.toLowerCase())
        const probeEvidence = results.map((r) => ({
          kind: '@',
          source: 'Profile probe',
          detail:
            r.found === true
              ? `${r.platform} — profile found (${r.confidence} confidence) · ${r.reason}`
              : r.found === false
                ? `${r.platform} — no profile found`
                : r.found === 'blocked'
                  ? `${r.platform} — BLOCKED, inconclusive`
                  : `${r.platform} — inconclusive`,
          url: r.url,
          meta: { platformProbe: true, platform: r.platform, handle: handle.toLowerCase(), found: r.found, method: r.method, confidence: r.confidence },
        }))
        store.addFindings(hubId, probeEvidence)
        const hits = results.filter((r) => r.found === true)
        if (hits.length) {
          store.addFindings(hubId, hits.map((r) => ({ ...r, source: 'Profile probe · open APIs' })))
        }
        const notFound = results.filter((r) => r.found === false).length
        const blocked = results.filter((r) => r.found === 'blocked').length
        pushLog(
          `Username hunt done — ${hits.length} confirmed · ${notFound} not-found · ${blocked} blocked / ${results.length - hits.length - notFound - blocked} inconclusive (all recorded as evidence)`,
          hits.length ? 'ok' : 'info'
        )
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
