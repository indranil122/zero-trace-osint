import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getStoredKey, setStoredKey } from '../api/ai'
import { getStoredHibpKey, setStoredHibpKey } from '../api/exposure'

export default function Settings({ onClose }) {
  const [key, setKey] = useState(getStoredKey())
  const [hibpKey, setHibpKey] = useState(getStoredHibpKey())
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <label className="field">
          <span>Anthropic API key (optional, enables AI features)</span>
          <input
            type="password"
            value={key}
            placeholder="sk-ant-…"
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <p className="dim">
          Stored only in this browser&apos;s localStorage. AI calls go directly from your browser
          to Anthropic using their CORS-enabled browser access header — no middleman server.
          Without a key, everything except AI correlation &amp; summaries still works.
        </p>
        <label className="field" style={{ marginTop: 12 }}>
          <span>HIBP API key (optional, for username/phone breach checks)</span>
          <input
            type="password"
            value={hibpKey}
            placeholder="hibp_… (haveibeenpwned.com/API/Key)"
            onChange={(e) => setHibpKey(e.target.value)}
          />
        </label>
        <p className="dim">
          For email, we use XposedOrNot (no key, CORS-open). For username/phone/domain, HIBP needs a key (BYO). Stored locally, never sent except to haveibeenpwned.com. Without it, exposure shows “provider unavailable” with manual-check guidance. Never displays passwords.
        </p>
        <div className="btn-row">
          <button
            className="wide"
            onClick={() => {
              setStoredKey(key.trim())
              setStoredHibpKey(hibpKey.trim())
              onClose()
            }}
          >
            Save keys
          </button>
          <button
            className="wide danger"
            onClick={() => {
              setStoredKey('')
              setStoredHibpKey('')
              setKey('')
              setHibpKey('')
              onClose()
            }}
          >
            Remove keys
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
