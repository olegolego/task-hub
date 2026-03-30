// @ts-nocheck
import React, { useEffect } from 'react'
import { useActivityStore } from '../../store/activityStore'
import EmptyState from '../shared/EmptyState'

const ACTION_ICONS = {
  'task:create': { icon: '+', color: '#06d6a0' },
  'task:delete': { icon: '-', color: '#ef476f' },
  'task:complete': { icon: '\u2713', color: '#4cc9f0' },
  'idea:post': { icon: '\u2606', color: '#ffd166' },
  'idea:vote': { icon: '\u2191', color: '#7209b7' },
  'group:create': { icon: 'G', color: '#4361ee' },
  'meeting:create': { icon: 'M', color: '#f72585' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ActivityPanel() {
  const { activities, loading, loadActivities } = useActivityStore()

  useEffect(() => {
    loadActivities()
  }, [])

  if (loading && activities.length === 0) {
    return (
      <div
        style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}
      >
        Loading activity...
      </div>
    )
  }

  if (activities.length === 0) {
    return <EmptyState type="activity" />
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
      <div
        style={{
          padding: '6px 14px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Recent Activity
        </span>
        <button
          onClick={() => loadActivities()}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 10,
            fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      </div>

      {activities.map((activity) => {
        const actionInfo = ACTION_ICONS[activity.message_type] || {
          icon: '\u2022',
          color: 'var(--text-secondary)',
        }

        return (
          <div
            key={activity.id}
            style={{
              display: 'flex',
              gap: 10,
              padding: '8px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {/* Action icon */}
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: `${actionInfo.color}15`,
                color: actionInfo.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {actionInfo.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                <strong style={{ color: activity.actor_color || 'var(--accent)' }}>
                  {activity.actor_name || 'Someone'}
                </strong>{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{activity.summary}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                {timeAgo(activity.created_at)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
