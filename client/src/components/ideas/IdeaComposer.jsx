import React, { useState } from 'react'
import { useIdeaStore } from '../../store/ideaStore'

export default function IdeaComposer({ groupId = null }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expanded, setExpanded] = useState(false)
  const { postIdea } = useIdeaStore()

  function handleSubmit(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    postIdea(t, body.trim(), groupId)
    setTitle('')
    setBody('')
    setExpanded(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: '8px 10px', background: 'var(--surface)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '0 10px',
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
        onBlurCapture={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
          <LightbulbIcon />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Share an idea…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          {title && (
            <button
              type="submit"
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 4,
                color: '#1a1a2e',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 7px',
                cursor: 'pointer',
                fontFamily: '"DM Sans", sans-serif',
              }}
            >
              POST
            </button>
          )}
        </div>

        {expanded && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add more details… (optional)"
            rows={2}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 12,
              fontFamily: 'inherit',
              resize: 'none',
              padding: '6px 0',
              lineHeight: 1.5,
            }}
          />
        )}
      </div>
    </form>
  )
}

const LightbulbIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
    <line x1="9" y1="18" x2="15" y2="18" />
    <line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
)
