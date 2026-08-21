export const KINDS = {
  domain: { label: 'Domain', icon: '🌐', color: '#7dd3fc' },
  subdomain: { label: 'Subdomain', icon: '📡', color: '#a5b4fc' },
  ip: { label: 'IP Address', icon: '🔌', color: '#fda4af' },
  email: { label: 'Email', icon: '✉️', color: '#86efac' },
  username: { label: 'Username', icon: '👤', color: '#fcd34d' },
  account: { label: 'Account', icon: '🔗', color: '#fb923c' },
  location: { label: 'Location', icon: '📍', color: '#e879f9' },
  phone: { label: 'Phone', icon: '📞', color: '#d8b4fe' },
  image: { label: 'Image / EXIF', icon: '🖼️', color: '#5eead4' },
  note: { label: 'Note', icon: '📝', color: '#cbd5e1' },
}

export const KIND_LIST = Object.keys(KINDS)

export function kindMeta(kind) {
  return KINDS[kind] || KINDS.note
}

export function normalizeValue(kind, raw) {
  let v = String(raw ?? '').trim()
  if (!v) return ''
  if (kind === 'domain' || kind === 'subdomain' || kind === 'nameserver') {
    v = v
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split(/[/?#]/)[0]
      .toLowerCase()
  } else if (kind === 'email') {
    v = v.toLowerCase()
  } else if (kind === 'username' || kind === 'account') {
    v = v.replace(/^@+/, '').toLowerCase()
  }
  return v.replace(/^\*\./, '').replace(/\.$/, '')
}

export function nodeIdOf(kind, value) {
  return `${kind}:${normalizeValue(kind, value)}`
}
