import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getStoredKey, setStoredKey } from '../api/ai'
import { getStoredHibpKey, setStoredHibpKey } from '../api/exposure'
import { hasLock, changeLock, clearLock, createLock } from '../utils/lock'

export default function Settings({ onClose }) {
  const [key, setKey] = useState(getStoredKey())
  const [hibpKey, setHibpKey] = useState(getStoredHibpKey())
  const [hasLocalLock, setHasLocalLock] = useState(() => hasLock())
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [lockMsg, setLockMsg] = useState('')
  const [lockErr, setLockErr] = useState('')
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
          <button type="button" className="icon-close" onClick={onClose} aria-label="Close">×</button>
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
          <span>HIBP API key (optional — email fallback only)</span>
          <input
            type="password"
            value={hibpKey}
            placeholder="hibp_… (haveibeenpwned.com/API/Key)"
            onChange={(e) => setHibpKey(e.target.value)}
          />
        </label>
        <p className="dim">
          <strong>Everything works without any key:</strong> email breaches + analytics via XposedOrNot,
          infostealer-log checks via Hudson Rock, domain breach catalogs via HIBP&apos;s public endpoint
          (with XposedOrNot fallback), and full phone intel — offline parsing, carrier lookup and one-click
          pivot searches. The HIBP key above only adds an extra email-breach fallback, and note their API
          blocks browsers by design, so it may still show &ldquo;provider unavailable&rdquo; without a proxy you control.
        </p>
        <div className="btn-row">
          <button type="button"
            className="wide"
            onClick={() => {
              setStoredKey(key.trim())
              setStoredHibpKey(hibpKey.trim())
              onClose()
            }}
          >
            Save keys
          </button>
          <button type="button"
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

        <div style={{ height: 1, background: 'var(--hairline)', margin: '14px 0' }} />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold tracking-tight">Local lock — browser only</h3>
          <p className="dim"><strong>Local Lock protects access to the app in this browser. It does NOT encrypt case data.</strong> To encrypt the data itself, use Vault export (.vtvault.json, AES-256-GCM). Stored as salted PBKDF2 250k hash in localStorage — no server, no recovery.</p>
          {hasLocalLock ? (
            <>
              <label className="field">
                <span>Current password</span>
                <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="••••••••" />
              </label>
              <label className="field">
                <span>New password · min 8 chars</span>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" />
              </label>
              <label className="field">
                <span>Confirm new password</span>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" />
              </label>
              {lockErr && <p className="lock-error">{lockErr}</p>}
              {lockMsg && <p className="dim" style={{ color: 'var(--ok)' }}>{lockMsg}</p>}
              <div className="btn-row">
                <button type="button" className="wide" onClick={async () => {
                  setLockErr(''); setLockMsg('')
                  if (newPw !== confirmPw) { setLockErr('Passwords do not match'); return }
                  try { await changeLock(curPw, newPw); setLockMsg('Password changed — use it next unlock'); setCurPw(''); setNewPw(''); setConfirmPw('') } catch (e) { setLockErr(e.message) }
                }}>Change password</button>
                <button type="button" className="wide danger" onClick={() => {
                  if (!window.confirm('Remove local lock? You will not be asked for a password on next launch. Cases remain.')) return
                  clearLock(); setHasLocalLock(false); setLockMsg('Lock removed'); setLockErr(''); setCurPw(''); setNewPw(''); setConfirmPw('')
                }}>Remove lock</button>
              </div>
            </>
          ) : (
            <>
              <p className="dim">No lock is set on this browser. Set one now — it will be required on next launch.</p>
              <label className="field">
                <span>New password · min 8 chars</span>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" />
              </label>
              <label className="field">
                <span>Confirm</span>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" />
              </label>
              {lockErr && <p className="lock-error">{lockErr}</p>}
              {lockMsg && <p className="dim" style={{ color: 'var(--ok)' }}>{lockMsg}</p>}
              <div className="btn-row">
                <button type="button" className="wide" onClick={async () => {
                  setLockErr(''); setLockMsg('')
                  if (newPw.length < 8) { setLockErr('Password must be at least 8 characters'); return }
                  if (newPw !== confirmPw) { setLockErr('Passwords do not match'); return }
                  try { await createLock(newPw); setHasLocalLock(true); setLockMsg('Lock created — will be required on next launch'); setNewPw(''); setConfirmPw('') } catch (e) { setLockErr(e.message) }
                }}>Create lock</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
