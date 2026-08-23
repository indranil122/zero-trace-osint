import { useState } from 'react'

export default function IpCheck() {
  const [ip, setIp] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function check() {
    const target = ip.trim() || ''
    // empty => check own IP (ip-api without path)
    const url = target
      ? `https://ip-api.com/json/${encodeURIComponent(target)}?fields=status,message,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,query,reverse`
      : `https://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,query,reverse`
    setLoading(true)
    setError('')
    setData(null)
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      if (j.status !== 'success') throw new Error(j.message || 'Lookup failed')
      setData(j)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Direct geolocation via ip-api.com — query leaves your browser for that single endpoint only.
        Leave empty to check your own egress IP.
      </p>
      <div className="flex gap-2">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="8.8.8.8 or leave empty for self"
          className="h-9 flex-1 rounded-full border border-input bg-background px-4 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="h-9 rounded-full bg-black px-5 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? '…' : 'Check IP'}
        </button>
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      {data && (
        <div className="rounded-2xl border bg-card p-4 text-sm shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">IP</span><br /><span className="font-mono font-medium">{data.query}</span></div>
            <div><span className="text-muted-foreground">Reverse</span><br /><span className="font-mono text-xs break-all">{data.reverse || '—'}</span></div>
            <div><span className="text-muted-foreground">Location</span><br />{[data.city, data.regionName, data.country].filter(Boolean).join(', ') || '—'}</div>
            <div><span className="text-muted-foreground">Coords</span><br />{data.lat != null ? `${data.lat}, ${data.lon}` : '—'}</div>
            <div className="col-span-2"><span className="text-muted-foreground">ISP / Org</span><br />{data.isp}{data.org ? ` · ${data.org}` : ''}</div>
            <div className="col-span-2"><span className="text-muted-foreground">ASN</span><br />{data.as || '—'}</div>
            <div><span className="text-muted-foreground">Proxy</span><br />{data.proxy ? 'Yes' : 'No'}</div>
            <div><span className="text-muted-foreground">Hosting</span><br />{data.hosting ? 'Yes' : 'No'}</div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Source: ip-api.com — use results for authorized recon only. For abuse handling, contact the listed ISP/ASN.</p>
        </div>
      )}
    </div>
  )
}
