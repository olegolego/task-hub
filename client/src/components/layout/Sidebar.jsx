import React from 'react'
import { NAV_PANELS } from '../../utils/constants'
import { useMessageStore } from '../../store/messageStore'

const TasksIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

const IdeasIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
)

const GroupsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const PeopleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const MessagesIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const FilesIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const NAV_ITEMS = [
  { id: NAV_PANELS.TASKS, title: 'Tasks', icon: TasksIcon },
  { id: NAV_PANELS.IDEAS, title: 'Ideas', icon: IdeasIcon },
  { id: NAV_PANELS.GROUPS, title: 'Groups', icon: GroupsIcon },
  { id: NAV_PANELS.PEOPLE, title: 'People', icon: PeopleIcon },
  { id: NAV_PANELS.MESSAGES, title: 'Messages', icon: MessagesIcon },
  { id: NAV_PANELS.FILES, title: 'Files', icon: FilesIcon },
  { id: NAV_PANELS.CALENDAR, title: 'Calendar', icon: CalendarIcon },
]

export default function Sidebar({ activePanel, onPanelChange }) {
  const totalUnread = useMessageStore((s) => s.totalUnread())
  return (
    <div
      style={{
        width: 40,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        paddingBottom: 6,
        gap: 4,
      }}
    >
      {NAV_ITEMS.map(({ id, title, icon: Icon }) => (
        <SidebarIcon
          key={id}
          title={title}
          active={activePanel === id}
          onClick={() => onPanelChange(id)}
          badge={id === NAV_PANELS.MESSAGES && totalUnread > 0 ? totalUnread : 0}
        >
          <Icon />
        </SidebarIcon>
      ))}
    </div>
  )
}

function SidebarIcon({ children, onClick, title, active, badge }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        borderRadius: 6,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#1a1a2e' : 'var(--text-secondary)',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          position: 'absolute',
          top: 2,
          right: 2,
          minWidth: 14,
          height: 14,
          borderRadius: 7,
          background: '#f72585',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 2px',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}
