// @ts-nocheck
import React, { useEffect, useRef } from 'react'
import { useSearchStore } from '../../store/searchStore'
import { useUIStore } from '../../store/uiStore'
import { PRIORITIES } from '../../utils/constants'

export default function SearchOverlay() {
  const { query, setQuery, results, clear } = useSearchStore()
  const { closeSearch, setActivePanel, openTaskDetail } = useUIStore()
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        clear()
        closeSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const totalResults =
    results.tasks.length + results.ideas.length + results.users.length + results.files.length

  function handleTaskClick(task) {
    openTaskDetail(task.id)
    closeSearch()
    clear()
  }

  function handleIdeaClick() {
    setActivePanel('ideas')
    closeSearch()
    clear()
  }

  function handleUserClick() {
    setActivePanel('people')
    closeSearch()
    clear()
  }

  function handleFileClick() {
    setActivePanel('files')
    closeSearch()
    clear()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 60,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          clear()
          closeSearch()
        }
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: 380,
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, ideas, people, files..."
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
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: 2,
              }}
            >
              <svg
                width="12"
                height="12"
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
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {!query.trim() && (
            <div
              style={{
                padding: '20px 14px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}
            >
              Type to search across your workspace
            </div>
          )}

          {query.trim() && totalResults === 0 && (
            <div
              style={{
                padding: '20px 14px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Tasks */}
          {results.tasks.length > 0 && (
            <ResultSection title="Tasks" count={results.tasks.length}>
              {results.tasks.map((task) => (
                <ResultItem
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  icon={
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: PRIORITIES[task.priority]?.color || '#8d99ae',
                        flexShrink: 0,
                      }}
                    />
                  }
                  primary={task.title}
                  secondary={task.completed ? 'Completed' : task.priority}
                />
              ))}
            </ResultSection>
          )}

          {/* Ideas */}
          {results.ideas.length > 0 && (
            <ResultSection title="Ideas" count={results.ideas.length}>
              {results.ideas.map((idea) => (
                <ResultItem
                  key={idea.id}
                  onClick={handleIdeaClick}
                  icon={<span style={{ fontSize: 11 }}>💡</span>}
                  primary={idea.title}
                  secondary={`${idea.vote_count || 0} votes · ${idea.status}`}
                />
              ))}
            </ResultSection>
          )}

          {/* People */}
          {results.users.length > 0 && (
            <ResultSection title="People" count={results.users.length}>
              {results.users.map((user) => (
                <ResultItem
                  key={user.id}
                  onClick={handleUserClick}
                  icon={
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: user.avatar_color || '#4361ee',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        color: '#fff',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {(user.display_name || '?')[0].toUpperCase()}
                    </span>
                  }
                  primary={user.display_name}
                  secondary={user.role}
                />
              ))}
            </ResultSection>
          )}

          {/* Files */}
          {results.files.length > 0 && (
            <ResultSection title="Files" count={results.files.length}>
              {results.files.map((file) => (
                <ResultItem
                  key={file.id}
                  onClick={handleFileClick}
                  icon={<span style={{ fontSize: 11 }}>📄</span>}
                  primary={file.name}
                  secondary={file.folder || 'General'}
                />
              ))}
            </ResultSection>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '6px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--text-secondary)',
            fontSize: 10,
          }}
        >
          <span>ESC to close</span>
          <span>{totalResults > 0 ? `${totalResults} results` : ''}</span>
        </div>
      </div>
    </div>
  )
}

function ResultSection({ title, count, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          padding: '6px 14px 4px',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title} ({count})
      </div>
      {children}
    </div>
  )
}

function ResultItem({ onClick, icon, primary, secondary }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontFamily: 'inherit',
        textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {primary}
      </span>
      {secondary && (
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>
          {secondary}
        </span>
      )}
    </button>
  )
}
