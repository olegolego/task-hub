import React from 'react'
import { useTaskStore } from '../store/taskStore'

interface TitleBarProps {
  panelTitle?: string
}

export default function TitleBar({ panelTitle = 'TASKS' }: TitleBarProps) {
  const {
    isPinned,
    togglePin,
    minimizeWindow,
    closeWindow,
    toggleTheme,
    theme,
    toggleShowCompleted,
    showCompleted,
  } = useTaskStore()

  return (
    <div
      className="drag-region flex items-center justify-between px-3 shrink-0"
      style={{
        height: 32,
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-2 no-drag">
        <span
          style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent)',
            letterSpacing: '0.05em',
          }}
        >
          {panelTitle}
        </span>
      </div>

      <div className="flex items-center gap-1 no-drag">
        <IconButton
          title={showCompleted ? 'Hide completed' : 'Show completed'}
          onClick={toggleShowCompleted}
          active={showCompleted}
        >
          <CheckIcon />
        </IconButton>

        <IconButton title="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </IconButton>

        <IconButton
          title={isPinned ? 'Unpin (disable always-on-top)' : 'Pin (always-on-top)'}
          onClick={togglePin}
          active={isPinned}
        >
          <PinIcon />
        </IconButton>

        <IconButton title="Minimize to tray" onClick={minimizeWindow}>
          <MinusIcon />
        </IconButton>

        <IconButton title="Close" onClick={closeWindow} danger>
          <XIcon />
        </IconButton>
      </div>
    </div>
  )
}

interface IconButtonProps {
  children: React.ReactNode
  onClick: () => void
  title: string
  active?: boolean
  danger?: boolean
}

function IconButton({ children, onClick, title, active, danger }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 4,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: danger ? '#ef476f' : active ? 'var(--accent)' : 'var(--text-secondary)',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--hover)'
        if (!danger) e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger
          ? '#ef476f'
          : active
            ? 'var(--accent)'
            : 'var(--text-secondary)'
      }}
    >
      {children}
    </button>
  )
}

const CheckIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const PinIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
)

const MinusIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const XIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const SunIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)
