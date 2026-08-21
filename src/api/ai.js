const KEY_STORAGE = 'zt-anthropic-key'
const DEFAULT_MODEL = 'claude-3-5-haiku-latest'

export function getStoredKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setStoredKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {}
}

async function claudeMessages({ key, model = DEFAULT_MODEL, system, user, maxTokens = 1200 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const err = await res.json()
      msg = err?.error?.message || msg
    } catch {}
    throw new Error(msg)
  }
  const j = await res.json()
  return (j.content || []).map((c) => c.text || '').join('').trim()
}

export async function aiSuggestLinks(entities, apiKey) {
  if (!entities.length) return []
  const lines = entities.map((e) => `${e.id} :: ${e.kind}`).join('\n')
  const text = await claudeMessages({
    key: apiKey,
    system:
      'You are a meticulous OSINT correlation analyst. You reason carefully about identity links and only ever output valid JSON. Never invent entity ids.',
    user: `Entity list (id :: type):\n${lines}\n\nIdentify pairs that likely refer to the same person, organization, or infrastructure. Respond ONLY with a minified JSON array of objects: [{"a":"<entity id>","b":"<entity id>","reason":"short explanation","confidence":"high"|"medium"|"low"}]. Strongest first, maximum 15 items. If there are no credible links respond with [].`,
    maxTokens: 1500,
  })

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI returned no parsable JSON')
  let arr
  try {
    arr = JSON.parse(match[0])
  } catch {
    throw new Error('AI JSON was malformed')
  }
  const ids = new Set(entities.map((e) => e.id))
  return arr
    .filter(
      (x) =>
        x && typeof x.a === 'string' && typeof x.b === 'string' && x.a !== x.b &&
        ids.has(x.a) && ids.has(x.b) && typeof x.reason === 'string'
    )
    .map((x) => ({
      aId: x.a,
      bId: x.b,
      reason: x.reason.slice(0, 200),
      confidence: ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : 'low',
    }))
}

export async function aiExecutiveSummary({ caseName, stats, entitiesSample, apiKey }) {
  const statLine = Object.entries(stats)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')
  const sample = entitiesSample
    .slice(0, 60)
    .map((e) => `- [${e.kind}] ${e.label}${e.evidenceCount ? ` (${e.evidenceCount} evidence items)` : ''}`)
    .join('\n')

  return claudeMessages({
    key: apiKey,
    system:
      'You are a senior OSINT analyst writing the executive summary of an intelligence report. Be factual, hedge uncertainty explicitly, never fabricate findings that are not supported by the provided entity list. Output GitHub-flavored markdown, max ~180 words.',
    user: `Case: "${caseName}"\nEntities: ${statLine}\n\nKey entities:\n${sample}\n\nWrite an executive summary: what/who this case appears to center on, the most operationally significant links between entities, and 2-3 concrete next investigative steps. Use short paragraphs and a bullet list for next steps.`,
    maxTokens: 800,
  })
}
