import React, { useState, useRef, useEffect, memo } from 'react'
import { PRIORITIES } from '../utils/constants'
import { useTaskStore } from '../store/taskStore'

const TaskItem = memo(function TaskItem({ task }) {
  const { toggleTask, updateTaskTitle, updateTaskPriority, deleteTask } = useTaskStore()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.title)
  const [hovered, setHovered] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const editRef = useRef(null)

  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  async function handleCheck() {
    setBouncing(true)
    setTimeout(() => setBouncing(false), 200)
    await toggleTask(task.id)
  }

  function startEdit() {
    setEditValue(task.title)
    setEditing(true)
  }

  async function commitEdit() {
    const t = editValue.trim()
    if (t && t !== task.title) await updateTaskTitle(task.id, t)
    setEditing(false)
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') { setEditValue(task.title); setEditing(false) }
  }

  async function handlePriorityChange(p) {
    await updateTaskPriority(task.id, p)
    setShowPriorityMenu(false)
  }

  const priorityColor = PRIORITIES[task.priority]?.color ?? '#8d99ae'
  const isCompleted = Boolean(task.completed)

  return (
    <div
      className="task-enter"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowPriorityMenu(false) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 6,
        margin: '0 6px 2px',
        background: hovered ? 'var(--hover)' : 'transparent',
        transition: 'background 0.12s',
        position: 'relative',
        cursor: 'default',
      }}
      onContextMenu={(e) => { e.preventDefault(); setShowPriorityMenu(true) }}
    >
      {/* Checkbox */}
      <button
        onClick={handleCheck}
        className={bouncing ? 'check-bounce' : ''}
        style={{
          flexShrink: 0,
          width: 17,
          height: 17,
          borderRadius: 4,
          border: `2px solid ${isCompleted ? priorityColor : 'var(--text-secondary)'}`,
          background: isCompleted ? priorityColor : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {isCompleted && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Priority dot */}
      <div
        onClick={() => setShowPriorityMenu((s) => !s)}
        title={`Priority: ${task.priority}`}
        style={{
          flexShrink: 0,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: priorityColor,
          opacity: isCompleted ? 0.4 : 1,
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
      />

      {/* Title */}
      {editing ? (
        <input
          ref={editRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleEditKeyDown}
          style={{
            flex: 1,
            background: 'var(--bg)',
            border: '1px solid var(--accent)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '2px 6px',
            outline: 'none',
          }}
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          style={{
            flex: 1,
            fontSize: 13,
            color: isCompleted ? 'var(--completed)' : 'var(--text-primary)',
            textDecoration: isCompleted ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'color 0.15s',
            cursor: 'text',
          }}
        >
          {task.title}
        </span>
      )}

      {/* Delete button */}
      {hovered && !editing && (
        <button
          onClick={() => deleteTask(task.id)}
          title="Delete"
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            borderRadius: 3,
            transition: 'color 0.12s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef476f'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Priority context menu */}
      {showPriorityMenu && (
        <div
          style={{
            position: 'absolute',
            right: 32,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: 4,
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {Object.entries(PRIORITIES).map(([p, { label, color }]) => (
            <button
              key={p}
              onClick={() => handlePriorityChange(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 10px',
                background: task.priority === p ? 'var(--hover)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = task.priority === p ? 'var(--hover)' : 'transparent'}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '2px 0' }} />
          <button
            onClick={startEdit}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px',
              background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer',
              color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit
          </button>
          <button
            onClick={() => { deleteTask(task.id); setShowPriorityMenu(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px',
              background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer',
              color: '#ef476f', fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,71,111,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
})

export default TaskItem
