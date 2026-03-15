import React, { useState, useEffect, useRef } from 'react'
import { useMessageStore } from '../../store/messageStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'
import { ipc } from '../../utils/ipc'

export default function MessagesPanel() {
  const { threads, activeThreadUserId, unreadCounts, setActiveThread, sendMessage } = useMessageStore()
  const users = useUserStore((s) => s.users)
  const onlineUserIds = useUserStore((s) => s.onlineIds)
  const myUserId = useConnectionStore((s) => s.myUserId)

  // All users except myself
  const peers = users.filter((u) => u.id !== myUserId)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Thread list */}
      <div style={{
        width: 120,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflowY: 'auto',
        padding: '8px 0',
      }}>
        {peers.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, padding: '8px 10px' }}>
            No other users yet
          </div>
        )}
        {peers.map((user) => {
          const isOnline = onlineUserIds.includes(user.id)
          const unread = unreadCounts[user.id] ?? 0
          const active = activeThreadUserId === user.id
          return (
            <button
              key={user.id}
              onClick={() => setActiveThread(user.id)}
              style={{
                width: '100%',
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                background: active ? 'var(--hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Avatar */}
              <div style={{
                position: 'relative',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: user.avatar_color || '#4361ee',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
              }}>
                {(user.display_name || '?')[0].toUpperCase()}
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isOnline ? '#06d6a0' : '#555',
                  border: '1.5px solid var(--surface)',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: unread > 0 ? 700 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.display_name}
                </div>
              </div>
              {unread > 0 && (
                <span style={{
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#f72585',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Thread view */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeThreadUserId
          ? <Thread
              userId={activeThreadUserId}
              myUserId={myUserId}
              messages={threads[activeThreadUserId] ?? []}
              users={users}
              onSend={(text) => sendMessage(activeThreadUserId, text)}
            />
          : <EmptyState />
        }
      </div>
    </div>
  )
}

function Thread({ userId, myUserId, messages, users, onSend }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const peer = users.find((u) => u.id === userId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  function submit() {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  async function handleSendFile() {
    setSending(true)
    try { await ipc.sendFileDM(userId) } finally { setSending(false) }
  }

  return (
    <>
      {/* Thread header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: peer?.avatar_color || '#4361ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>
          {(peer?.display_name || '?')[0].toUpperCase()}
        </div>
        <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{peer?.display_name ?? userId}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 9 }}>🔒 E2E encrypted</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center', marginTop: 24 }}>No messages yet. Say hello!</div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} isMine={m.fromUserId === myUserId} userId={userId} myUserId={myUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
        {/* File attach */}
        <button
          onClick={handleSendFile}
          disabled={sending}
          title="Send file (E2E encrypted)"
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
            background: 'var(--surface)', color: sending ? 'var(--text-secondary)' : 'var(--text-secondary)',
            cursor: sending ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => { if (!sending) e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter to send)"
          rows={1}
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
        />
        <button
          onClick={submit}
          disabled={!input.trim()}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: input.trim() ? 'var(--accent)' : 'var(--surface)', color: input.trim() ? '#1a1a2e' : 'var(--text-secondary)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
        </button>
      </div>
    </>
  )
}

function MessageBubble({ m, isMine, userId, myUserId }) {
  const { deleteMessage, editMessage } = useMessageStore()
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const editRef = useRef(null)
  const isFile = !!m.fileId
  const isDeleted = !!m.deletedAt

  function startEdit() {
    setEditText(m.text || '')
    setEditing(true)
    setTimeout(() => editRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditing(false)
    setEditText('')
  }

  function submitEdit() {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === m.text) { cancelEdit(); return }
    editMessage(m.id, trimmed, userId)
    cancelEdit()
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  function handleDelete() {
    if (window.confirm('Delete this message? This cannot be undone.')) {
      deleteMessage(m.id)
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: 'relative', maxWidth: '80%' }}>
        {/* Action buttons — only for own non-deleted text messages */}
        {hovered && isMine && !isDeleted && !isFile && !editing && (
          <div style={{
            position: 'absolute', top: -10, right: 0,
            display: 'flex', gap: 3, zIndex: 10,
          }}>
            <button
              onClick={startEdit}
              title="Edit message"
              style={{
                width: 20, height: 20, borderRadius: '50%', border: 'none',
                background: 'var(--surface)', color: 'var(--text-secondary)',
                fontSize: 10, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >✎</button>
            <button
              onClick={handleDelete}
              title="Delete message"
              style={{
                width: 20, height: 20, borderRadius: '50%', border: 'none',
                background: '#ef476f', color: '#fff',
                fontSize: 10, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >✕</button>
          </div>
        )}

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <textarea
              ref={editRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={2}
              style={{
                background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 8,
                color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px',
                resize: 'none', outline: 'none', fontFamily: 'inherit', minWidth: 180,
              }}
            />
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <button onClick={cancelEdit} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitEdit} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#1a1a2e', cursor: 'pointer', fontWeight: 600 }}>Save</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: isDeleted ? 'transparent' : isMine ? 'var(--accent)' : 'var(--surface)',
              color: isDeleted ? 'var(--text-secondary)' : isMine ? '#1a1a2e' : 'var(--text-primary)',
              border: isDeleted ? '1px dashed rgba(255,255,255,0.15)' : 'none',
              borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              padding: '6px 10px', fontSize: 12, lineHeight: 1.4, wordBreak: 'break-word',
              fontStyle: isDeleted ? 'italic' : 'normal',
              cursor: 'default',
            }}
          >
            {isDeleted
              ? 'Message deleted'
              : isFile
                ? <FileMessage m={m} isMine={isMine} myUserId={myUserId} />
                : m.text
            }
          </div>
        )}
      </div>

      <span style={{ color: 'var(--text-secondary)', fontSize: 9, marginTop: 2 }}>
        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {m.editedAt && <span style={{ marginLeft: 4 }}>(edited)</span>}
      </span>
    </div>
  )
}

function FileMessage({ m, isMine, myUserId }) {
  const [downloading, setDownloading] = useState(false)
  const [status, setStatus] = useState(null)

  async function download() {
    setDownloading(true)
    setStatus(null)
    try {
      const fromUserId = m.fromUserId
      const result = await ipc.downloadFileDM({ fileId: m.fileId, fileName: m.fileName, encFileKey: m.encFileKey, fileKeyNonce: m.fileKeyNonce, fromUserId })
      if (result.ok) setStatus('saved')
      else if (!result.canceled) setStatus('error')
    } catch { setStatus('error') }
    finally { setDownloading(false) }
  }

  const ext = (m.fileName || '').split('.').pop()?.toLowerCase()
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 20 }}>{isImage ? '🖼' : '📎'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.fileName || 'File'}
        </div>
        <div style={{ fontSize: 9, opacity: 0.7 }}>
          {m.fileSize ? `${(m.fileSize / 1024).toFixed(1)} KB` : ''} · 🔒 encrypted
        </div>
      </div>
      <button
        onClick={download}
        disabled={downloading}
        style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: downloading ? 'default' : 'pointer', fontSize: 10, color: 'inherit', fontWeight: 600, flexShrink: 0 }}
      >
        {downloading ? '…' : status === 'saved' ? '✓' : status === 'error' ? '✗' : '↓'}
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-secondary)',
      fontSize: 12,
      flexDirection: 'column',
      gap: 8,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      Select a person to start messaging
    </div>
  )
}
