// @ts-nocheck
import React, { useState, useEffect } from 'react'
import { useTaskStore } from '../../store/taskStore'
import { useUIStore } from '../../store/uiStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'
import { PRIORITIES } from '../../utils/constants'
import { ipc } from '../../utils/ipc'

export default function TaskDetailPanel() {
  const taskId = useUIStore((s) => s.showTaskDetail)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId))
  const users = useUserStore((s) => s.users)
  const myId = useConnectionStore((s) => s.myUserId)

  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)

  useEffect(() => {
    if (task) {
      setDescription(task.description || '')
      setDueDate(task.due_date || '')
      setAssignedTo(task.assigned_to || '')
    }
  }, [taskId, task?.description, task?.due_date, task?.assigned_to])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') closeTaskDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!task) return null

  const priorityColor = PRIORITIES[task.priority]?.color || '#8d99ae'
  const isCompleted = Boolean(task.completed)
  const createdBy = users.find((u) => u.id === task.created_by)

  function saveDescription() {
    if (description !== (task.description || '')) {
      ipc.sendMessage({ type: 'task:update', payload: { id: task.id, description } })
    }
    setEditingDesc(false)
  }

  function saveDueDate(val) {
    setDueDate(val)
    ipc.sendMessage({ type: 'task:update', payload: { id: task.id, dueDate: val || null } })
  }

  function saveAssignment(val) {
    setAssignedTo(val)
    ipc.sendMessage({ type: 'task:assign', payload: { id: task.id, assignedTo: val || null } })
  }

  function formatDate(dateStr) {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const isOverdue = task.due_date && !isCompleted && new Date(task.due_date) < new Date()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeTaskDetail()
      }}
    >
      <div
        style={{
          width: '85%',
          maxWidth: 360,
          height: '100%',
          background: 'var(--bg)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Task Details
          </span>
          <button
            onClick={closeTaskDetail}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 4,
            }}
          >
            <svg
              width="14"
              height="14"
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
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
          {/* Title & status */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: priorityColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: isCompleted ? 'var(--completed)' : 'var(--text-primary)',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Tag color={priorityColor}>{task.priority}</Tag>
              <Tag color={isCompleted ? '#06d6a0' : '#4cc9f0'}>
                {isCompleted ? 'Done' : task.status || 'Todo'}
              </Tag>
              {isOverdue && <Tag color="#f72585">Overdue</Tag>}
            </div>
          </div>

          {/* Description */}
          <FieldSection label="Description">
            {editingDesc ? (
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setDescription(task.description || '')
                      setEditingDesc(false)
                    }
                  }}
                  autoFocus
                  rows={4}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--accent)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    padding: '8px 10px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <SmallButton onClick={saveDescription}>Save</SmallButton>
                  <SmallButton
                    onClick={() => {
                      setDescription(task.description || '')
                      setEditingDesc(false)
                    }}
                    secondary
                  >
                    Cancel
                  </SmallButton>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                style={{
                  fontSize: 12,
                  color: description ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  background: 'var(--surface)',
                  borderRadius: 6,
                  minHeight: 36,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {description || 'Click to add a description...'}
              </div>
            )}
          </FieldSection>

          {/* Due Date */}
          <FieldSection label="Due Date">
            <input
              type="date"
              value={dueDate || ''}
              onChange={(e) => saveDueDate(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: isOverdue ? '#f72585' : 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'inherit',
                padding: '6px 10px',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            {dueDate && (
              <span
                style={{
                  fontSize: 11,
                  color: isOverdue ? '#f72585' : 'var(--text-secondary)',
                  marginLeft: 8,
                }}
              >
                {formatDate(dueDate)}
              </span>
            )}
          </FieldSection>

          {/* Assigned To */}
          <FieldSection label="Assigned To">
            <select
              value={assignedTo || ''}
              onChange={(e) => saveAssignment(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'inherit',
                padding: '6px 10px',
                outline: 'none',
                cursor: 'pointer',
                minWidth: 140,
              }}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                  {u.id === myId ? ' (me)' : ''}
                </option>
              ))}
            </select>
          </FieldSection>

          {/* Metadata */}
          <FieldSection label="Info">
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {createdBy && (
                <div>
                  Created by{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{createdBy.display_name}</strong>
                </div>
              )}
              <div>Created {formatDate(task.created_at)}</div>
              {task.updated_at && task.updated_at !== task.created_at && (
                <div>Updated {formatDate(task.updated_at)}</div>
              )}
              {task.group_id && <div>Group task</div>}
            </div>
          </FieldSection>
        </div>
      </div>
    </div>
  )
}

function FieldSection({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function Tag({ color, children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 10,
        background: `${color}22`,
        color: color,
        textTransform: 'capitalize',
      }}
    >
      {children}
    </span>
  )
}

function SmallButton({ onClick, children, secondary }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: secondary ? 'var(--surface)' : 'var(--accent)',
        color: secondary ? 'var(--text-secondary)' : '#1a1a2e',
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  )
}
