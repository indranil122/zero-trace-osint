import exifr from 'exifr'

function fmtExposure(s) {
  if (!s || typeof s !== 'number') return null
  return s >= 1 ? `${s}s` : `1/${Math.round(1 / s)}s`
}

export async function exifScan(file) {
  if (file.size > 60 * 1024 * 1024) throw new Error('Image too large (60 MB cap)')

  const data = await exifr.parse(file, { gps: true, translateValues: true })
  if (!data || Object.keys(data).length === 0) {
    throw new Error('No EXIF metadata found — image was likely stripped or is a screenshot')
  }

  const findings = []

  const cam = [data.Make, data.Model].filter(Boolean).join(' ').trim()
  if (cam) findings.push({ kind: '@', source: 'EXIF · local file', detail: `Camera: ${cam}` })
  if (data.LensModel) findings.push({ kind: '@', source: 'EXIF · local file', detail: `Lens: ${data.LensModel}` })
  if (data.Software) findings.push({ kind: '@', source: 'EXIF · local file', detail: `Software: ${data.Software}` })

  const taken = data.DateTimeOriginal || data.CreateDate || data.ModifyDate
  if (taken) {
    const d = taken instanceof Date ? taken : new Date(taken)
    if (!Number.isNaN(d.getTime())) {
      findings.push({
        kind: '@',
        source: 'EXIF · local file',
        detail: `Captured: ${d.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
      })
    }
  }

  const exposure = [
    data.ISO != null && `ISO ${data.ISO}`,
    data.FNumber != null && `f/${data.FNumber}`,
    fmtExposure(data.ExposureTime),
    data.FocalLength != null && `${Math.round(data.FocalLength)}mm`,
  ].filter(Boolean)
  if (exposure.length) {
    findings.push({ kind: '@', source: 'EXIF · local file', detail: `Settings: ${exposure.join(' · ')}` })
  }

  if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
    const lat = Number(data.latitude.toFixed(6))
    const lon = Number(data.longitude.toFixed(6))
    const maps = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    findings.push({
      kind: '@',
      source: 'EXIF · GPS',
      detail: `GPS embedded: ${lat}, ${lon} (±${Math.round(data.GPSAltitude || 0)}m alt)`,
      url: maps,
    })
    findings.push({
      kind: 'location',
      value: `${lat},${lon}`,
      source: 'EXIF · GPS',
      detail: 'Coordinates extracted from image metadata',
      url: maps,
    })
  }

  if (findings.length <= 0) throw new Error('Metadata present but nothing usable')
  return findings
}
