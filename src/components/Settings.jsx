import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getStoredKey, setStoredKey } from '../api/ai'

export default function Settings({ onClose }) {
  const [key, setKey] = useState(getStoredKey())
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
        <div className="btn-row">
          <button
            className="wide"
            onClick={() => {
              setStoredKey(key.trim())
              onClose()
            }}
          >
            Save key
          </button>
          <button
            className="wide danger"
            onClick={() => {
              setStoredKey('')
              setKey('')
              onClose()
            }}
          >
            Remove key
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
