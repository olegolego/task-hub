import React, { useEffect, useRef, useState } from 'react'
import { useLLMStore } from '../../store/llmStore'

const MENTION_CONTEXTS = [
  { key: 'tasks',    label: 'Tasks',    icon: '✓', desc: 'Your tasks & team tasks' },
  { key: 'ideas',    label: 'Ideas',    icon: '💡', desc: 'Team ideas & proposals' },
  { key: 'files',    label: 'Files',    icon: '📄', desc: 'Company documents & uploads' },
  { key: 'meetings', label: 'Meetings', icon: '📅', desc: 'Upcoming calendar events' },
  { key: 'messages', label: 'Messages', icon: '💬', desc: 'Recent group messages' },
  { key: 'users',    label: 'Users',    icon: '👥', desc: 'Team members' },
]

export default function LLMPanel() {
  const {
    chats, activeChatId, messagesByChat,
    thinking, loadingHistory, llmStatus, llmModel, lastError,
    checkStatus, loadChats, newChat, selectChat, sendMessage, deleteChat, renameChat,
  } = useLLMStore()

  const [input, setInput] = useState('')
  const [useFiles, setUseFiles] = useState(false)
  const [mention, setMention] = useState({ active: false, query: '', startIndex: 0, selectedIndex: 0, filtered: [] })
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const activeMessages = (activeChatId ? messagesByChat[activeChatId] : null) || []

  useEffect(() => {
    checkStatus()
    loadChats()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, thinking])

  function handleInputChange(e) {
    const val = e.target.value
    setInput(val)

    const cursor = e.target.selectionStart
    const textUpToCursor = val.slice(0, cursor)
    const match = textUpToCursor.match(/@(\w*)$/)

    if (match) {
      const query = match[1].toLowerCase()
      const filtered = MENTION_CONTEXTS.filter(c =>
        c.key.startsWith(query) || c.label.toLowerCase().startsWith(query)
      )
      if (filtered.length > 0) {
        setMention({ active: true, query, startIndex: match.index, selectedIndex: 0, filtered })
        return
      }
    }
    if (mention.active) setMention(m => ({ ...m, active: false }))
  }

  function selectMention(ctx) {
    const before = input.slice(0, mention.startIndex)
    const after = input.slice(mention.startIndex + mention.query.length + 1)
    const newInput = before + '@' + ctx.key + ' ' + after
    setInput(newInput)
    setMention(m => ({ ...m, active: false }))
    setTimeout(() => {
      if (inputRef.current) {
        const pos = (before + '@' + ctx.key + ' ').length
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || thinking) return
    const text = input.trim()
    setInput('')
    sendMessage(text, useFiles)
    if (activeChatId) {
      useLLMStore.getState().addMessage(activeChatId, {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      })
    }
  }

  function handleKeyDown(e) {
    if (mention.active) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMention(m => ({ ...m, selectedIndex: Math.min(m.selectedIndex + 1, m.filtered.length - 1) }))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMention(m => ({ ...m, selectedIndex: Math.max(m.selectedIndex - 1, 0) }))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(mention.filtered[mention.selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMention(m => ({ ...m, active: false }))
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Chat list sidebar */}
      <div style={{
        width: 180,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Assistant</span>
          <StatusDot status={llmStatus} model={llmModel} />
        </div>

        {/* New chat button */}
        <button
          onClick={newChat}
          style={{ margin: '8px 8px 4px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#1a1a2e', fontSize: 11, fontWeight: 700, padding: '5px 8px', cursor: 'pointer', textAlign: 'left' }}
        >
          + New Chat
        </button>

        {/* Chat list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>No conversations yet</div>
          )}
          {chats.map(chat => (
            <ChatItem
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              onSelect={() => selectChat(chat.id)}
              onDelete={() => deleteChat(chat.id)}
              onRename={(title) => renameChat(chat.id, title)}
            />
          ))}
        </div>

        {/* Model info */}
        {llmModel && (
          <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 9, color: 'var(--text-secondary)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {llmModel}
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
            {activeChatId
              ? (chats.find(c => c.id === activeChatId)?.title || 'Chat')
              : 'Select or start a conversation'}
          </span>
          {llmStatus === 'offline' && (
            <span style={{ fontSize: 10, color: '#ef476f', background: 'rgba(239,71,111,0.1)', padding: '2px 6px', borderRadius: 3 }}>
              LLM offline — start llm/start.sh on server
            </span>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!activeChatId && (
            <EmptyState status={llmStatus} onNew={newChat} />
          )}
          {loadingHistory && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: 24 }}>Loading…</div>
          )}
          {activeMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {thinking && <ThinkingBubble />}
          {lastError && (
            <div style={{ alignSelf: 'flex-start', background: 'rgba(239,71,111,0.1)', border: '1px solid rgba(239,71,111,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef476f', maxWidth: '80%' }}>
              {lastError}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--surface)', position: 'relative' }}
        >
          {/* @mention dropdown */}
          {mention.active && (
            <MentionDropdown
              items={mention.filtered}
              selectedIndex={mention.selectedIndex}
              onSelect={selectMention}
              onHover={(i) => setMention(m => ({ ...m, selectedIndex: i }))}
            />
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={activeChatId ? 'Ask anything… type @ to reference data sources' : 'Start a new chat above, then ask something…'}
              rows={2}
              disabled={llmStatus === 'offline'}
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 12,
                padding: '7px 10px',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'none',
                lineHeight: 1.4,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking || llmStatus === 'offline'}
              style={{
                background: thinking || !input.trim() ? 'var(--hover)' : 'var(--accent)',
                border: 'none',
                borderRadius: 6,
                color: thinking || !input.trim() ? 'var(--text-secondary)' : '#1a1a2e',
                fontSize: 11,
                fontWeight: 700,
                padding: '8px 14px',
                cursor: thinking || !input.trim() ? 'default' : 'pointer',
                height: 44,
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {thinking ? '…' : 'Send'}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={useFiles}
              onChange={(e) => setUseFiles(e.target.checked)}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Include company files in context</span>
          </label>
        </form>
      </div>
    </div>
  )
}

function MentionDropdown({ items, selectedIndex, onSelect, onHover }) {
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <div
      ref={listRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 12,
        right: 12,
        marginBottom: 4,
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        zIndex: 100,
        maxHeight: 260,
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '5px 10px 3px', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.6 }}>
        Data sources
      </div>
      {items.map((ctx, i) => (
        <div
          key={ctx.key}
          onMouseDown={(e) => { e.preventDefault(); onSelect(ctx) }}
          onMouseEnter={() => onHover(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 12px',
            cursor: 'pointer',
            background: i === selectedIndex ? 'rgba(255,255,255,0.07)' : 'transparent',
            borderLeft: i === selectedIndex ? '2px solid var(--accent)' : '2px solid transparent',
            transition: 'background 0.1s',
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{ctx.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              @{ctx.key}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>
              {ctx.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status, model }) {
  const color = status === 'online' ? '#06d6a0' : status === 'offline' ? '#ef476f' : '#888'
  const label = status === 'online' ? `Online${model ? ` · ${model.split('/').pop()}` : ''}` : status === 'offline' ? 'Offline' : 'Checking…'
  return (
    <span title={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{status === 'online' ? 'online' : status === 'offline' ? 'offline' : '?'}</span>
    </span>
  )
}

function ChatItem({ chat, active, onSelect, onDelete, onRename }) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const editRef = useRef(null)

  function startEdit(e) {
    e.stopPropagation()
    setEditTitle(chat.title)
    setEditing(true)
    setTimeout(() => { editRef.current?.select() }, 0)
  }

  function commitEdit() {
    const t = editTitle.trim()
    if (t && t !== chat.title) onRename(t)
    setEditing(false)
  }

  function handleEditKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={editing ? undefined : onSelect}
      style={{
        padding: '6px 10px',
        cursor: editing ? 'default' : 'pointer',
        background: active ? 'var(--hover)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {editing ? (
        <input
          ref={editRef}
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleEditKey}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 3, color: 'var(--text-primary)', fontSize: 11, padding: '1px 4px', outline: 'none', fontFamily: 'inherit' }}
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          style={{ flex: 1, fontSize: 11, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title="Double-click to rename"
        >
          {chat.title}
        </span>
      )}
      {!editing && (hovered || active) && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={startEdit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 10, padding: 0, opacity: 0.7 }}
            title="Rename"
          >✎</button>
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this chat?')) onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef476f', fontSize: 10, padding: 0, opacity: 0.7 }}
            title="Delete"
          >✕</button>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '80%',
          background: isUser ? 'var(--accent)' : 'var(--surface)',
          color: isUser ? '#1a1a2e' : 'var(--text-primary)',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          padding: '8px 12px',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          border: isUser ? 'none' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px 12px 12px 2px',
        padding: '10px 16px',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'llm-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            opacity: 0.7,
          }} />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ status, onNew }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, color: 'var(--text-secondary)' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.3 }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <div style={{ textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
        {status === 'offline'
          ? 'LLM server is offline.\nRun bash ~/task-hub/llm/start.sh on the GPU server.'
          : 'Ask the AI anything about your tasks,\nteam, meetings, or company files.\nType @ to reference specific data sources.'}
      </div>
      {status !== 'offline' && (
        <button
          onClick={onNew}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#1a1a2e', fontSize: 12, fontWeight: 700, padding: '8px 18px', cursor: 'pointer' }}
        >
          Start a conversation
        </button>
      )}
    </div>
  )
}
