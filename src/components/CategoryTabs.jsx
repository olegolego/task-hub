import React from 'react'
import { useTaskStore } from '../store/taskStore'
import { CATEGORIES } from '../utils/constants'

export default function CategoryTabs() {
  const { activeCategory, setActiveCategory, tasks } = useTaskStore()

  const counts = {}
  CATEGORIES.forEach((c) => {
    counts[c] = c === 'all'
      ? tasks.filter((t) => !t.completed).length
      : tasks.filter((t) => t.category === c && !t.completed).length
  })

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: '4px 8px',
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto',
      }}
    >
      {CATEGORIES.map((cat) => (
        <Tab
          key={cat}
          label={cat}
          count={counts[cat]}
          active={activeCategory === cat}
          onClick={() => setActiveCategory(cat)}
        />
      ))}
    </div>
  )
}

function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '3px 10px',
        borderRadius: 4,
        border: 'none',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#1a1a2e' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        fontFamily: '"DM Sans", sans-serif',
        cursor: 'pointer',
        textTransform: 'capitalize',
        letterSpacing: '0.02em',
        transition: 'background 0.15s, color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--hover)'; if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: active ? 'rgba(26,26,46,0.3)' : 'var(--hover)',
          color: active ? '#1a1a2e' : 'var(--text-secondary)',
          borderRadius: 10,
          padding: '0 5px',
          fontSize: 10,
          fontWeight: 600,
          minWidth: 16,
          textAlign: 'center',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}
