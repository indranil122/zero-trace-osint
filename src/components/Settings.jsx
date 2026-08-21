import { useState } from 'react'
import { getStoredKey, setStoredKey } from '../api/ai'

export default function Settings({ onClose }) {
  const [key, setKey] = useState(getStoredKey())

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
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
    </div>
  )
}
