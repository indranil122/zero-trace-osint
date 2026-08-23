import { useState, useMemo } from 'react'

function tmLinks(q) {
  const e = encodeURIComponent(q.trim())
  if (!e) return []
  return [
    { label: 'USPTO TESS', href: `https://tmsearch.uspto.gov/search/search-information?search=${e}`, note: 'US federal' },
    { label: 'EUIPO eSearch', href: `https://www.euipo.europa.eu/eSearch/#basic/1+1+1+1/${e}`, note: 'EU' },
    { label: 'WIPO Global Brand DB', href: `https://www3.wipo.int/branddb/en/search.jsp?q=%7B%22searches%22%3A%5B%7B%22te%22%3A%22${e}%22%7D%5D%7D`, note: 'International' },
    { label: 'UK IPO', href: `https://trademarks.ipo.gov.uk/ipo-tmtext?query=${e}`, note: 'UK' },
  ]
}

export default function TrademarkCheck() {
  const [q, setQ] = useState('')
  const links = useMemo(() => tmLinks(q), [q])

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        We do not query trademark offices directly (no CORS). Enter a mark and open the official search in a new tab — your query is sent only to the registry you click.
      </p>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zero-Trace, Acme™ …"
          className="h-9 flex-1 rounded-full border border-input bg-background px-4 text-sm"
        />
        <span className="inline-flex h-9 items-center rounded-full border bg-muted px-3 text-xs text-muted-foreground">{q.trim() ? `${q.trim().length} chars` : 'type a mark'}</span>
      </div>
      {q.trim() ? (
        <div className="grid grid-cols-2 gap-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col rounded-2xl border bg-card p-3 text-sm shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
            >
              <span className="font-medium">{l.label} ↗</span>
              <span className="text-xs text-muted-foreground">{l.note}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Tip: search word marks first, then figurative elements. For legal clearance, consult counsel — this tool is triage only.</p>
      )}
      <div className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Note on IP use:</strong> A public OSINT hit does not grant trademark or copyright licence. Verify ownership, licence, and fair-use before reuse. When in doubt, don’t publish the mark.
      </div>
    </div>
  )
}
