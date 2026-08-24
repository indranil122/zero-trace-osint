import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { privacyContent, termsContent, gdprContent, ccpaContent, dataComplianceContent } from './LegalContent'
import IpCheck from './IpCheck'
import TrademarkCheck from './TrademarkCheck'

const TABS = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'gdpr', label: 'GDPR' },
  { id: 'ccpa', label: 'CCPA' },
  { id: 'data', label: 'Data' },
  { id: 'ip', label: 'IP Check' },
  { id: 'tm', label: 'Trademark' },
]

function Section({ content }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{content.title}</h3>
        <p className="text-xs text-muted-foreground">Updated {content.updated}</p>
        {content.intro && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{content.intro}</p>}
      </div>
      {content.sections.map((s) => (
        <div key={s.h} className="rounded-2xl border bg-card p-4 shadow-sm">
          <h4 className="text-sm font-semibold">{s.h}</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.p}</p>
        </div>
      ))}
    </div>
  )
}

export default function LegalModal({ initialTab = 'privacy', onClose }) {
  const [tab, setTab] = useState(initialTab)

  useEffect(() => setTab(initialTab), [initialTab])

  useEffect(() => {
    try {
      const fromHash = window.location.hash.replace(/^#/, '')
      if (fromHash && TABS.some((t) => t.id === fromHash)) setTab(fromHash)
    } catch {}
  }, [])

  useEffect(() => {
    try { if (tab) window.location.hash = tab } catch {}
  }, [tab])

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  function handleClose() {
    try {
      if (window.location.hash.replace(/^#/, '') === tab) history.replaceState(null, '', window.location.pathname + window.location.search)
    } catch {}
    onClose()
  }

  return createPortal(
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal report max-w-[860px]"
        role="dialog"
        aria-modal="true"
        aria-label="Legal center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Legal center</h2>
          <button type="button" className="icon-close" onClick={handleClose} aria-label="Close">×</button>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${tab === t.id ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-white/10'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="report-body max-h-[56vh] overflow-auto">
          {tab === 'privacy' && <Section content={privacyContent} />}
          {tab === 'terms' && <Section content={termsContent} />}
          {tab === 'gdpr' && <Section content={gdprContent} />}
          {tab === 'ccpa' && <Section content={ccpaContent} />}
          {tab === 'data' && <Section content={dataComplianceContent} />}
          {tab === 'ip' && <IpCheck />}
          {tab === 'tm' && <TrademarkCheck />}
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          This is an open-source research tool (MIT). For legal advice, consult counsel. Last review: 23 Aug 2026.
        </p>
      </div>
    </div>,
    document.body
  )
}
