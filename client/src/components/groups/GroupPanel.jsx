import React, { useState, useEffect } from 'react'
import { useGroupStore } from '../../store/groupStore'
import { useTaskStore } from '../../store/taskStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'
import TaskInput from '../TaskInput'
import TaskList from '../TaskList'

export default function GroupPanel() {
  const { groups, activeGroupId, setActiveGroupId, createGroup, joinGroup, leaveGroup, inviteUser, fetchMembers, membersByGroup } = useGroupStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const users = useUserStore((s) => s.users)
  const myUserId = useConnectionStore((s) => s.myUserId)

  function handleCreateGroup(e) {
    e.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    createGroup(name)
    setNewGroupName('')
    setShowCreate(false)
  }

  function handleJoinGroup(e) {
    e.preventDefault()
    const id = joinId.trim()
    if (!id) return
    joinGroup(id)
    setJoinId('')
    setShowJoin(false)
  }

  // Fetch members when opening a group
  useEffect(() => {
    if (activeGroupId) fetchMembers(activeGroupId)
  }, [activeGroupId])

  if (activeGroupId) {
    const group = groups.find(g => g.id === activeGroupId)
    const members = membersByGroup[activeGroupId] ?? []
    const memberIds = new Set(members.map(m => m.id))
    // Users not yet in this group (excludes self)
    const invitableUsers = users.filter(u => u.id !== myUserId && !memberIds.has(u.id))

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Group header */}
        <div style={{
          padding: '8px 10px', background: 'var(--surface)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexDirection: 'column', display: 'flex', gap: 6,
        }}>
          {/* Top row: back + name + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setActiveGroupId(null); setConfirmLeave(false); setShowInvite(false) }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <BackIcon />
          </button>
          <div
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: group?.color ?? 'var(--accent)', flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            {group?.name ?? 'Group'}
          </span>
          {members.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          )}
          {confirmLeave ? (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Leave group?</span>
              <button
                onClick={() => { leaveGroup(activeGroupId); setConfirmLeave(false) }}
                style={{
                  background: '#ef476f', border: 'none', borderRadius: 4,
                  color: '#fff', fontSize: 11, fontWeight: 600,
                  padding: '3px 8px', cursor: 'pointer',
                }}
              >
                Yes, leave
              </button>
              <button
                onClick={() => setConfirmLeave(false)}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11,
                  padding: '3px 8px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLeave(true)}
              title="Leave group"
              style={{
                marginLeft: 'auto', background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ef476f'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              Leave
            </button>
          )}
          </div>{/* end top row */}

          {/* Invite row */}
          {!confirmLeave && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setShowInvite(!showInvite)}
                style={{
                  background: showInvite ? 'var(--accent)' : 'var(--hover)',
                  border: 'none', borderRadius: 4,
                  color: showInvite ? '#1a1a2e' : 'var(--text-primary)',
                  fontSize: 11, padding: '3px 8px', cursor: 'pointer',
                }}
              >
                + Invite
              </button>
              {showInvite && invitableUsers.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  All users are already in this group
                </span>
              )}
              {showInvite && invitableUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => { inviteUser(activeGroupId, u.id); setShowInvite(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4, color: 'var(--text-primary)',
                    fontSize: 11, padding: '3px 8px', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#1a1a2e' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: u.avatar_color || '#4361ee',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>
                    {(u.display_name || '?')[0].toUpperCase()}
                  </span>
                  {u.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <TaskInput groupId={activeGroupId} />
        <TaskList groupId={activeGroupId} />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '6px 10px', background: 'var(--surface)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 6,
      }}>
        <ActionButton onClick={() => { setShowCreate(true); setShowJoin(false) }}>
          + New Group
        </ActionButton>
        <ActionButton onClick={() => { setShowJoin(true); setShowCreate(false) }}>
          Join
        </ActionButton>
      </div>

      {/* Create group form */}
      {showCreate && (
        <form onSubmit={handleCreateGroup} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Group name…"
              autoFocus
              style={{
                flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)',
                borderRadius: 4, color: 'var(--text-primary)', fontSize: 12,
                padding: '4px 8px', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button type="submit" style={{
              background: 'var(--accent)', border: 'none', borderRadius: 4,
              color: '#1a1a2e', fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer',
            }}>Create</button>
            <button type="button" onClick={() => setShowCreate(false)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11,
            }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Join group form */}
      {showJoin && (
        <form onSubmit={handleJoinGroup} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              placeholder="Group ID…"
              autoFocus
              style={{
                flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)',
                borderRadius: 4, color: 'var(--text-primary)', fontSize: 12,
                padding: '4px 8px', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button type="submit" style={{
              background: 'var(--accent)', border: 'none', borderRadius: 4,
              color: '#1a1a2e', fontSize: 11, fontWeight: 600, padding: '4px 10px', cursor: 'pointer',
            }}>Join</button>
            <button type="button" onClick={() => setShowJoin(false)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11,
            }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Group list */}
      {groups.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 8, color: 'var(--text-secondary)', padding: 24,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span style={{ fontSize: 13, textAlign: 'center', opacity: 0.6 }}>
            No groups yet.<br />Create or join one above.
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
          {groups.map(group => (
            <GroupRow key={group.id} group={group} onClick={() => setActiveGroupId(group.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupRow({ group, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 6, marginBottom: 2,
        background: hovered ? 'var(--hover)' : 'transparent',
        cursor: 'pointer', transition: 'background 0.12s',
      }}
    >
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: group.color ?? 'var(--accent)', flexShrink: 0,
      }} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{group.name}</span>
      {group.description && (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
          {group.description}
        </span>
      )}
      <ChevronIcon />
    </div>
  )
}

function ActionButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--hover)', border: 'none', borderRadius: 4,
        color: 'var(--text-primary)', fontSize: 11, padding: '4px 10px',
        cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#1a1a2e' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
    >
      {children}
    </button>
  )
}

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
