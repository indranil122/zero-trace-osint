import { useState } from 'react'
import { hasLock, createLock, verifyLock, clearLock } from '../utils/lock'

export default function LockScreen({ onUnlock }) {
  const locked = hasLock()
  const [mode, setMode] = useState(locked ? 'unlock' : 'setup')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [oneTimePw, setOneTimePw] = useState(null) // for setup share view

  async function handleSetup() {
    setError('')
    if (pw.length < 8) { setError('Password must be at least 8 characters'); return }
    if (pw !== confirm) { setError('Passwords do not match'); return }
    setBusy(true)
    try {
      await createLock(pw)
      setOneTimePw(pw)
      setMode('one-time')
      setPw('')
      setConfirm('')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleUnlock() {
    setError('')
    if (!pw) { setError('Enter the local password'); return }
    setBusy(true)
    try {
      const ok = await verifyLock(pw)
      if (!ok) { setError('Wrong password'); setBusy(false); return }
      onUnlock()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  function handleReset() {
    if (!window.confirm('Reset local lock? This removes the password gate but keeps existing cases. You will set a new password next launch.')) return
    clearLock()
    setMode('setup')
    setPw(''); setConfirm(''); setError(''); setOneTimePw(null)
  }

  return (
    <div className="lock-wrap">
      <div className="lock-card">
        <div className="lock-brand">
          <div className="lock-mark">VT</div>
          <div>
            <h1>VeilTrace</h1>
            <p>Private OSINT Workbench</p>
          </div>
        </div>

        {mode === 'one-time' && oneTimePw ? (
          <>
            <div className="lock-badge ok">Local lock created</div>
            <h2>One-time view — share internally only</h2>
            <p className="dim">This password is stored only in this browser. Copy it now to share with your team over a private channel. It will not be shown again.</p>
            <div className="lock-onetime">
              <code>{oneTimePw}</code>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(oneTimePw); }}>Copy</button>
            </div>
            <p className="dim" style={{ fontSize: 11, textAlign: 'center' }}>Local Lock guards app access only — case data is NOT encrypted at rest. Export an encrypted Vault (.vtvault.json) to protect the data itself. No server is involved in either.</p>
            <button type="button" className="lock-primary" onClick={onUnlock}>Continue to workbench →</button>
          </>
        ) : mode === 'setup' ? (
          <>
            <div className="lock-badge">First start — one-time setup</div>
            <h2>Create a local password</h2>
            <p className="dim">This password gates access to the workbench on this browser. It is stored only here (PBKDF2 250k + salt, hashed). Share the password internally once — it is not sent to any server. People on this device can create their own password in Settings later. The gate is local to browser storage only.</p>
            <label className="field">
              <span>New password · min 8 chars</span>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && handleSetup()} />
                <button type="button" className="lock-eye" onClick={() => setShowPw((v) => !v)}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
            </label>
            <label className="field">
              <span>Confirm</span>
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && handleSetup()} />
            </label>
            {error && <p className="lock-error">{error}</p>}
            <button type="button" className="lock-primary" onClick={handleSetup} disabled={busy}>{busy ? 'Creating…' : 'Create & continue →'}</button>
            <p className="dim" style={{ fontSize: 11, textAlign: 'center' }}>Local only. No account. Reset clears the gate, not your cases. See <a href="#privacy" target="_blank" rel="noreferrer">Privacy</a>.</p>
          </>
        ) : (
          <>
            <div className="lock-badge warn">Local lock enabled</div>
            <h2>Unlock this browser</h2>
            <p className="dim">Enter the local password set on this browser to access cases. This check is local — no server, no network. Forgot it? Reset creates a new one.</p>
            <label className="field">
              <span>Local password</span>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUnlock()} />
                <button type="button" className="lock-eye" onClick={() => setShowPw((v) => !v)}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
            </label>
            {error && <p className="lock-error">{error}</p>}
            <button type="button" className="lock-primary" onClick={handleUnlock} disabled={busy}>{busy ? 'Checking…' : 'Unlock →'}</button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="lock-ghost" onClick={handleReset} style={{ flex: 1 }}>Reset lock</button>
              <button type="button" className="lock-ghost" onClick={() => { setMode('setup'); setError(''); }} style={{ flex: 1 }}>Use another password</button>
            </div>
            <p className="dim" style={{ fontSize: 11, textAlign: 'center' }}>Tip: change the password anytime in Settings → Local lock. Each browser has its own gate.</p>
          </>
        )}
      </div>
      <p className="lock-foot">Browser storage only · PBKDF2 250k · No server · <a href="#privacy">Privacy</a> · <a href="#terms">Terms</a></p>
    </div>
  )
}
