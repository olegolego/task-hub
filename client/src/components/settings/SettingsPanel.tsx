// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useConnectionStore } from '../../store/connectionStore'
import { ipc } from '../../utils/ipc'

export default function SettingsPanel() {
  const { closeSettings, theme, toggleTheme } = useUIStore()
  const { displayName, serverUrl, myRole } = useConnectionStore()

  const [newName, setNewName] = useState(displayName || '')
  const [newUrl, setNewUrl] = useState(serverUrl || '')
  const [notifyDM, setNotifyDM] = useState(true)
  const [notifyTask, setNotifyTask] = useState(true)
  const [notifyMeeting, setNotifyMeeting] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ipc.getConfig().then((config) => {
      if (config) {
        setNewName(config.displayName || displayName || '')
        setNewUrl(config.serverUrl || serverUrl || '')
        setNotifyDM(config.notifyDM !== false)
        setNotifyTask(config.notifyTask !== false)
        setNotifyMeeting(config.notifyMeeting !== false)
      }
    })
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function handleSave() {
    await ipc.saveConfig({
      displayName: newName.trim() || displayName,
      serverUrl: newUrl.trim() || serverUrl,
      notifyDM,
      notifyTask,
      notifyMeeting,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 950,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings()
      }}
    >
      <div
        style={{
          width: '88%',
          maxWidth: 360,
          background: 'var(--bg)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Settings
          </span>
          <button
            onClick={closeSettings}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 4,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {/* Profile section */}
          <SectionTitle>Profile</SectionTitle>

          <FieldRow label="Display Name">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={inputStyle}
              placeholder="Your name"
            />
          </FieldRow>

          <FieldRow label="Role">
            <span
              style={{
                fontSize: 12,
                color: 'var(--accent)',
                textTransform: 'capitalize',
                fontWeight: 600,
              }}
            >
              {myRole || 'member'}
            </span>
          </FieldRow>

          {/* Connection */}
          <SectionTitle>Connection</SectionTitle>

          <FieldRow label="Server URL">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              style={inputStyle}
              placeholder="ws://192.168.1.x:8765"
            />
          </FieldRow>

          {/* Appearance */}
          <SectionTitle>Appearance</SectionTitle>

          <FieldRow label="Theme">
            <button
              onClick={toggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </FieldRow>

          {/* Notifications */}
          <SectionTitle>Notifications</SectionTitle>

          <ToggleRow label="Direct messages" checked={notifyDM} onChange={setNotifyDM} />
          <ToggleRow label="Task assignments" checked={notifyTask} onChange={setNotifyTask} />
          <ToggleRow label="Meeting invites" checked={notifyMeeting} onChange={setNotifyMeeting} />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {saved && (
            <span
              style={{ fontSize: 11, color: '#06d6a0', alignSelf: 'center', marginRight: 'auto' }}
            >
              Settings saved
            </span>
          )}
          <button
            onClick={closeSettings}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: '#1a1a2e',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-primary)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
          position: 'relative',
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  )
}
