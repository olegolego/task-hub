// @ts-nocheck
import React from 'react'
import TaskItem from './TaskItem'
import { useTaskStore } from '../store/taskStore'
import { useUIStore } from '../store/uiStore'
import EmptyState from './shared/EmptyState'

export default function TaskList({ groupId = null }) {
  const getFilteredTasks = useTaskStore((s) => s.getFilteredTasks)
  const showCompleted = useUIStore((s) => s.showCompleted)
  const tasks = getFilteredTasks(groupId, showCompleted)

  if (tasks.length === 0) {
    return <EmptyState type="tasks" style={{ flex: 1 }} />
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
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              fontFamily: '"DM Sans", sans-serif',
              letterSpacing: '0.06em',
            }}
          >
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
