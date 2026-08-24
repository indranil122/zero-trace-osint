export const KINDS = {
  domain: { label: 'Domain', icon: '🌐', color: '#7dd3fc' },
  subdomain: { label: 'Subdomain', icon: '📡', color: '#a5b4fc' },
  nameserver: { label: 'Nameserver', icon: '🛰️', color: '#93c5fd' },
  ip: { label: 'IP Address', icon: '🔌', color: '#fda4af' },
  email: { label: 'Email', icon: '✉️', color: '#86efac' },
  username: { label: 'Username', icon: '👤', color: '#fcd34d' },
  account: { label: 'Account', icon: '🔗', color: '#fb923c' },
  breach: { label: 'Breach', icon: '🔓', color: '#f43f5e' },
  risk: { label: 'Risk Profile', icon: '🛡️', color: '#f59e0b' },
  collection: { label: 'Collection', icon: '📦', color: '#a1a1aa' },
  name: { label: 'Name', icon: '🧑', color: '#a3e635' },
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
  } else if (kind === 'breach' || kind === 'risk' || kind === 'collection') {
    v = v.trim()
  } else if (kind === 'name') {
    v = v.trim()
  } else if (kind === 'phone') {
    v = v.replace(/[\s\-()]/g, '').trim()
  }
  return v.replace(/^\*\./, '').replace(/\.$/, '')
}

export function nodeIdOf(kind, value) {
  return `${kind}:${normalizeValue(kind, value)}`
}

const EDGE_LABELS = {
  'domain>ip': 'resolves-to',
  'domain>subdomain': 'has-subdomain',
  'domain>nameserver': 'delegates-to',
  'domain>email': 'registrant-contact',
  'domain>breach': 'exposed-in',
  'domain>risk': 'has-risk',
  'domain>collection': 'has-collection',
  'subdomain>ip': 'resolves-to',
  'subdomain>subdomain': 'has-subdomain',
  'subdomain>nameserver': 'delegates-to',
  'subdomain>collection': 'has-collection',
  'username>account': 'found-on',
  'username>breach': 'exposed-in',
  'username>collection': 'has-collection',
  'account>username': 'handle-of',
  'email>domain': 'hosted-at',
  'email>breach': 'exposed-in',
  'phone>breach': 'exposed-in',
  'image>breach': 'exposed-in',
  'name>breach': 'exposed-in',
  'breach>email': 'affects',
  'breach>domain': 'affects',
  'ip>risk': 'has-risk',
  'collection>subdomain': 'contains',
  'collection>account': 'contains',
}

export function edgeLabelFor(parentKind, childKind) {
  return (
    EDGE_LABELS[`${parentKind}>${childKind}`] ||
    (childKind === 'email' ? 'mentions-email' : null) ||
    'related-to'
  )
}
