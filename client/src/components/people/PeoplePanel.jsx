import React from 'react'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'

export default function PeoplePanel() {
  const { users, onlineIds } = useUserStore()
  const { myUserId } = useConnectionStore()

  const online = users.filter(u => onlineIds.includes(u.id))
  const offline = users.filter(u => !onlineIds.includes(u.id))

  if (users.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-secondary)', padding: 24,
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span style={{ fontSize: 13, textAlign: 'center', opacity: 0.6 }}>
          No one here yet.<br />Connect to a server to see teammates.
        </span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
      {online.length > 0 && (
        <>
          <SectionLabel label={`ONLINE (${online.length})`} />
          {online.map(user => (
            <UserRow key={user.id} user={user} isOnline={true} isMe={user.id === myUserId} />
          ))}
        </>
      )}

      {offline.length > 0 && (
        <>
          <SectionLabel label={`OFFLINE (${offline.length})`} />
          {offline.map(user => (
            <UserRow key={user.id} user={user} isOnline={false} isMe={user.id === myUserId} />
          ))}
        </>
      )}
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{
      padding: '4px 10px 2px',
      fontSize: 10,
      color: 'var(--text-secondary)',
      fontFamily: '"DM Sans", sans-serif',
      letterSpacing: '0.06em',
    }}>
      {label}
    </div>
  )
}

function UserRow({ user, isOnline, isMe }) {
  const [hovered, setHovered] = React.useState(false)
  const name = user.display_name || user.displayName || 'Unknown'
  const initials = name.slice(0, 2).toUpperCase()
  const avatarColor = user.avatar_color || user.avatarColor || '#4361ee'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 10px', margin: '0 6px 2px',
        borderRadius: 6,
        background: hovered ? 'var(--hover)' : 'transparent',
        transition: 'background 0.12s',
        opacity: isOnline ? 1 : 0.5,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: avatarColor, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 11, fontWeight: 600,
        color: '#1a1a2e', flexShrink: 0, position: 'relative',
      }}>
        {initials}
        {/* Online indicator */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 8, height: 8, borderRadius: '50%',
          background: isOnline ? '#06d6a0' : '#8d99ae',
          border: '1.5px solid var(--bg)',
        }} />
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
          {isMe && <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 6 }}>(you)</span>}
        </div>
        {user.role && user.role !== 'member' && (
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{user.role}</div>
        )}
      </div>

      {/* Status dot */}
      <div
        className={isOnline ? 'pulse' : ''}
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isOnline ? '#06d6a0' : 'transparent',
          flexShrink: 0,
        }}
      />
    </div>
  )
}
