// @ts-nocheck
import React from 'react'
import { useConnectionStore } from '../../store/connectionStore'
import { useUserStore } from '../../store/userStore'

const STATE_LABELS = {
  connecting: { label: 'Connecting…', color: '#ffd166' },
  authenticating: { label: 'Authenticating…', color: '#ffd166' },
  connected: { label: 'Connected', color: '#06d6a0' },
  offline: { label: 'Offline', color: '#8d99ae' },
}

export default function StatusBar() {
  const { state, serverUrl, displayName } = useConnectionStore()
  const { onlineIds } = useUserStore()

  const info = STATE_LABELS[state] || STATE_LABELS.offline
  const onlineCount = onlineIds.length

  return (
    <div
      style={{
        height: 24,
        flexShrink: 0,
        background: 'var(--surface)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        fontSize: 10,
        color: 'var(--text-secondary)',
        fontFamily: '"DM Sans", sans-serif',
        letterSpacing: '0.04em',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span
          className={state === 'connected' ? 'pulse' : ''}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: info.color,
            display: 'inline-block',
          }}
        />
        <span style={{ color: info.color }}>{info.label}</span>
        {serverUrl && state !== 'offline' && (
          <span style={{ opacity: 0.5, marginLeft: 4 }}>{serverUrl.replace(/^wss?:\/\//, '')}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {displayName && <span style={{ opacity: 0.6 }}>{displayName}</span>}
        {state === 'connected' && onlineCount > 0 && (
          <span style={{ opacity: 0.5 }}>· {onlineCount} online</span>
        )}
      </div>
    </div>
  )
}
