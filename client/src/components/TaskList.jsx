import React from 'react'
import TaskItem from './TaskItem'
import { useTaskStore } from '../store/taskStore'

export default function TaskList({ groupId = null }) {
  const getFilteredTasks = useTaskStore((s) => s.getFilteredTasks)
  const tasks = getFilteredTasks(groupId)

  if (tasks.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text-secondary)',
          padding: 24,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span style={{ fontSize: 13, textAlign: 'center', opacity: 0.6 }}>
          No tasks yet.<br />Add one above!
        </span>
      </div>
    )
  }

  const incomplete = tasks.filter((t) => !t.completed)
  const completed = tasks.filter((t) => t.completed)

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingBottom: 8 }}>
      {incomplete.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}

      {completed.length > 0 && incomplete.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 10px 4px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: '"DM Sans", sans-serif', letterSpacing: '0.06em' }}>
            DONE
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>
      )}

      {completed.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  )
}
