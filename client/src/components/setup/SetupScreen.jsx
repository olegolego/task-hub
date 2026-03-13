import React, { useState, useEffect } from 'react'
import { ipc } from '../../utils/ipc'

export default function SetupScreen({ onComplete }) {
  const [displayName, setDisplayName] = useState('')
  const [serverUrl, setServerUrl] = useState('ws://localhost:8765')
  const [publicKey, setPublicKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ipc.getPublicKey().then(key => {
      if (key) setPublicKey(key)
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const name = displayName.trim()
    const url = serverUrl.trim()

    if (!name) { setError('Please enter a display name.'); return }
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      setError('Server URL must start with ws:// or wss://')
      return
    }

    setSaving(true)
    setError('')
    try {
      await ipc.saveConfig({ displayName: name, serverUrl: url })
      onComplete?.()
    } catch (err) {
      setError('Failed to save config: ' + err.message)
      setSaving(false)
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', color: 'var(--text-primary)',
      fontFamily: 'inherit',
    }}>
      {/* Drag region / title bar */}
      <div
        className="drag-region"
        style={{
          height: 32, background: 'var(--surface)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', fontFamily: '"DM Sans", sans-serif', letterSpacing: '0.05em' }}>
          TASKHUB SETUP
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Welcome to TaskHub</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Collaborative networked task management</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Your display name">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Alice"
              autoFocus
              style={inputStyle}
            />
          </FormField>

          <FormField label="Server URL">
            <input
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="ws://192.168.1.x:8765"
              style={inputStyle}
            />
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
              Run the TaskHub server on a local machine and enter its address.
            </p>
          </FormField>

          {publicKey && (
            <FormField label="Your public key (Ed25519)">
              <div style={{
                fontFamily: 'monospace', fontSize: 9,
                color: 'var(--text-secondary)', background: 'var(--surface)',
                borderRadius: 4, padding: '6px 8px', wordBreak: 'break-all',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {publicKey}
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
                Stored at ~/.taskmanager/id_ed25519. Share the .pub file to authorize on other servers.
              </p>
            </FormField>
          )}

          {error && (
            <p style={{ fontSize: 12, color: '#ef476f', background: 'rgba(239,71,111,0.1)', borderRadius: 4, padding: '6px 10px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? 'var(--hover)' : 'var(--accent)',
              border: 'none', borderRadius: 6,
              color: saving ? 'var(--text-secondary)' : '#1a1a2e',
              fontSize: 13, fontWeight: 600,
              padding: '10px', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: '"DM Sans", sans-serif', letterSpacing: '0.02em',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Connecting…' : 'Connect & Launch'}
          </button>
        </form>
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: '"DM Sans", sans-serif', letterSpacing: '0.04em' }}>
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 13,
  padding: '8px 10px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
  width: '100%',
}
