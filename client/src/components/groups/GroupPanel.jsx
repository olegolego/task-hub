import React, { useState, useEffect, useRef } from 'react'
import { useGroupStore } from '../../store/groupStore'
import { useTaskStore } from '../../store/taskStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'
import { useGroupChatStore } from '../../store/groupChatStore'
import TaskInput from '../TaskInput'
import TaskList from '../TaskList'

export default function GroupPanel() {
  const {
    groups, activeGroupId, setActiveGroupId, createGroup, joinGroup, leaveGroup,
    inviteUser, fetchMembers, membersByGroup,
    pendingInvites, pendingJoinRequests, respondToInvite, respondToJoinRequest,
  } = useGroupStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [activeTab, setActiveTab] = useState('tasks')
  const inviteRef = useRef(null)
  const users = useUserStore((s) => s.users)
  const unreadByGroup = useGroupChatStore((s) => s.unreadByGroup)

  // Close invite dropdown when clicking outside
  useEffect(() => {
    if (!showInvite) return
    function handleClick(e) {
      if (inviteRef.current && !inviteRef.current.contains(e.target)) setShowInvite(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showInvite])
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

  // Fetch members when opening a group, reset tab
  useEffect(() => {
    if (activeGroupId) {
      fetchMembers(activeGroupId)
      setActiveTab('tasks')
    }
  }, [activeGroupId])

  if (activeGroupId) {
    const group = groups.find(g => g.id === activeGroupId)
    const members = membersByGroup[activeGroupId] ?? []
    const memberIds = new Set(members.map(m => m.id))
    const invitableUsers = users.filter(u => u.id !== myUserId && !memberIds.has(u.id))
    const myRole = members.find(m => m.id === myUserId)?.role
    const joinRequestsForThisGroup = pendingJoinRequests.filter(r => r.groupId === activeGroupId)

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

          {/* Invite button */}
          {!confirmLeave && (
            <div ref={inviteRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowInvite(!showInvite)}
                style={{
                  background: showInvite ? 'var(--accent)' : 'var(--hover)',
                  border: 'none', borderRadius: 4,
                  color: showInvite ? '#1a1a2e' : 'var(--text-primary)',
                  fontSize: 11, padding: '3px 8px', cursor: 'pointer',
                }}
              >
                + Invite people
              </button>

              {showInvite && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                  background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '6px 0', minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100,
                }}>
                  {invitableUsers.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                      Everyone is already in this group
                    </div>
                  ) : (
                    invitableUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { inviteUser(activeGroupId, u.id); setShowInvite(false) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          padding: '7px 12px', textAlign: 'left',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: u.avatar_color || '#4361ee', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 10, fontWeight: 700,
                        }}>
                          {(u.display_name || '?')[0].toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                          {u.display_name}
                        </span>
                        <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 10, fontWeight: 600 }}>
                          Invite
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab bar */}
        {(() => {
          const chatUnread = unreadByGroup[activeGroupId] ?? 0
          return (
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => { setActiveTab('tasks'); useGroupChatStore.getState().setActiveGroup(null) }}
                style={{ flex: 1, padding: '6px', background: 'none', border: 'none', borderBottom: activeTab === 'tasks' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'tasks' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              >Tasks</button>
              <button
                onClick={() => { setActiveTab('chat'); useGroupChatStore.getState().setActiveGroup(activeGroupId); useGroupChatStore.getState().loadHistory(activeGroupId) }}
                style={{ flex: 1, padding: '6px', background: 'none', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid var(--accent)' : '2px solid transparent', color: activeTab === 'chat' ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                Chat
                {chatUnread > 0 && activeTab !== 'chat' && (
                  <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#f72585', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                )}
              </button>
            </div>
          )
        })()}

        {activeTab === 'tasks' && (
          <>
            {/* Pending join requests (visible to group admins) */}
            {myRole === 'admin' && joinRequestsForThisGroup.length > 0 && (
              <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {joinRequestsForThisGroup.map(req => (
                  <div key={req.inviteId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: req.requesterColor || '#4361ee', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 9, fontWeight: 700,
                    }}>
                      {(req.requesterName || '?')[0].toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>
                      <b style={{ color: 'var(--text-primary)' }}>{req.requesterName}</b> wants to join
                    </span>
                    <button
                      onClick={() => respondToJoinRequest(req.inviteId, true)}
                      style={{ background: '#06d6a0', border: 'none', borderRadius: 4, color: '#1a1a2e', fontSize: 10, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}
                    >Approve</button>
                    <button
                      onClick={() => respondToJoinRequest(req.inviteId, false)}
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}
                    >Deny</button>
                  </div>
                ))}
              </div>
            )}
            <TaskInput groupId={activeGroupId} />
            <TaskList groupId={activeGroupId} />
          </>
        )}

        {activeTab === 'chat' && <GroupChat groupId={activeGroupId} myUserId={myUserId} />}
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

      {/* Pending invites (this user was invited and must accept/decline) */}
      {pendingInvites.length > 0 && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Invitations</span>
          {pendingInvites.map(inv => (
            <div key={inv.inviteId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: inv.groupColor || 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                <b>{inv.groupName}</b>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> from {inv.fromName}</span>
              </span>
              <button
                onClick={() => respondToInvite(inv.inviteId, true)}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#1a1a2e', fontSize: 10, fontWeight: 700, padding: '3px 8px', cursor: 'pointer' }}
              >Join</button>
              <button
                onClick={() => respondToInvite(inv.inviteId, false)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}
              >Decline</button>
            </div>
          ))}
        </div>
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

function GroupChat({ groupId, myUserId }) {
  const messages = useGroupChatStore((s) => s.messagesByGroup[groupId] ?? [])
  const sendMessage = useGroupChatStore((s) => s.sendMessage)
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  function submit() {
    if (!input.trim()) return
    sendMessage(groupId, input)
    setInput('')
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center', marginTop: 24 }}>No messages yet. Say something!</div>
        )}
        {messages.map(m => {
          const isMine = m.fromUserId === myUserId
          return (
            <div key={m.id} style={{ display: 'flex', gap: 7, flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: m.fromColor || '#4361ee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>
                {(m.fromName || '?')[0].toUpperCase()}
              </span>
              <div style={{ maxWidth: '75%' }}>
                {!isMine && <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{m.fromName}</div>}
                <div style={{ background: isMine ? 'var(--accent)' : 'var(--surface)', color: isMine ? '#1a1a2e' : 'var(--text-primary)', borderRadius: isMine ? '10px 10px 2px 10px' : '10px 10px 10px 2px', padding: '6px 9px', fontSize: 12, lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {m.body}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message group… (Enter to send)"
          rows={1}
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
        />
        <button onClick={submit} disabled={!input.trim()} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: input.trim() ? 'var(--accent)' : 'var(--surface)', color: input.trim() ? '#1a1a2e' : 'var(--text-secondary)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
        </button>
      </div>
    </div>
  )
}
