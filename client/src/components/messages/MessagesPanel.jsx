import React, { useState, useEffect, useRef } from 'react'
import { useMessageStore } from '../../store/messageStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'

export default function MessagesPanel() {
  const { threads, activeThreadUserId, unreadCounts, setActiveThread, sendMessage } = useMessageStore()
  const users = useUserStore((s) => s.users)
  const onlineUserIds = useUserStore((s) => s.onlineUsers)
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
  const bottomRef = useRef(null)
  const peer = users.find((u) => u.id === userId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  return (
    <>
      {/* Thread header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: peer?.avatar_color || '#4361ee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
        }}>
          {(peer?.display_name || '?')[0].toUpperCase()}
        </div>
        <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>
          {peer?.display_name ?? userId}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 9 }}>
          🔒 E2E encrypted
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center', marginTop: 24 }}>
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.fromUserId === myUserId
          return (
            <div key={m.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isMine ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%',
                background: isMine ? 'var(--accent)' : 'var(--surface)',
                color: isMine ? '#1a1a2e' : 'var(--text-primary)',
                borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '6px 10px',
                fontSize: 12,
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}>
                {m.text}
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 9, marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: 6,
        flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter to send)"
          rows={1}
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 12,
            padding: '6px 10px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
          }}
        />
        <button
          onClick={submit}
          disabled={!input.trim()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: input.trim() ? 'var(--accent)' : 'var(--surface)',
            color: input.trim() ? '#1a1a2e' : 'var(--text-secondary)',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            alignSelf: 'flex-end',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </>
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
