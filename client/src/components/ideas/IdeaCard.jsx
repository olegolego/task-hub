import React, { useState } from 'react'
import { useIdeaStore } from '../../store/ideaStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'

const STATUS_COLORS = {
  open: '#4cc9f0',
  discussed: '#ffd166',
  accepted: '#06d6a0',
  archived: '#8d99ae',
}

export default function IdeaCard({ idea }) {
  const { voteIdea, changeIdeaStatus } = useIdeaStore()
  const { getUserById } = useUserStore()
  const { myUserId } = useConnectionStore()
  const [showMenu, setShowMenu] = useState(false)

  const author = getUserById(idea.created_by)
  const voteCount = idea.vote_count || 0

  return (
    <div
      className="idea-card"
      onMouseLeave={() => setShowMenu(false)}
      style={{
        margin: '0 6px 6px',
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--surface)',
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Vote column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => voteIdea(idea.id, 1)}
            title="Upvote"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 2, borderRadius: 3,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#06d6a0'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <UpvoteIcon />
          </button>
          <span style={{ fontSize: 11, fontWeight: 600, color: voteCount > 0 ? '#06d6a0' : voteCount < 0 ? '#ef476f' : 'var(--text-secondary)', minWidth: 14, textAlign: 'center' }}>
            {voteCount}
          </span>
          <button
            onClick={() => voteIdea(idea.id, -1)}
            title="Downvote"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 2, borderRadius: 3,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ef476f'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <DownvoteIcon />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {idea.title}
            </span>
            {idea.pinned ? <PinBadge /> : null}
          </div>

          {idea.body && (
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 4px', lineHeight: 1.4 }}>
              {idea.body}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
            <span style={{
              display: 'inline-block',
              padding: '1px 6px',
              borderRadius: 10,
              background: `${STATUS_COLORS[idea.status] ?? '#8d99ae'}22`,
              color: STATUS_COLORS[idea.status] ?? '#8d99ae',
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 500,
            }}>
              {idea.status}
            </span>
            {author && <span>{author.display_name || author.displayName}</span>}
            {idea.comment_count > 0 && <span>{idea.comment_count} comments</span>}
          </div>
        </div>

        {/* Context menu button */}
        <button
          onClick={() => setShowMenu(s => !s)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 2, borderRadius: 3,
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <DotsIcon />
        </button>
      </div>

      {/* Status change menu */}
      {showMenu && (
        <div style={{
          position: 'absolute', right: 8, top: 32,
          background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, padding: 4, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <button
              key={status}
              onClick={() => { changeIdeaStatus(idea.id, status); setShowMenu(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px',
                background: idea.status === status ? 'var(--hover)' : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: 12, whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = idea.status === status ? 'var(--hover)' : 'transparent'}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const UpvoteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

const DownvoteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
)

const PinBadge = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#ffd166' }}>
    <path d="M12 2l1.5 5h5l-4 3 1.5 5L12 12l-4 3 1.5-5-4-3h5z" />
  </svg>
)
