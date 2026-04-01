import React, { useState, useRef, useEffect } from 'react'
import { useTaskStore } from '../store/taskStore'
import { parseTaskInput } from '../utils/constants'

interface TaskInputProps {
  groupId?: string | null
}

export default function TaskInput({ groupId = null }: TaskInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { addTask, setInputRef } = useTaskStore()

  useEffect(() => {
    setInputRef(inputRef.current)
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    const { title, priority } = parseTaskInput(trimmed)
    if (!title) return
    addTask(title, priority, groupId)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: '8px 10px',
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg)',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '0 10px',
          height: 36,
          transition: 'border-color 0.15s',
        }}
        onFocusCapture={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlurCapture={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
      >
        <PlusIcon />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add task…  !urgent !high !med !low"
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
        {value && (
          <button
            type="submit"
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 4,
              color: '#1a1a2e',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              cursor: 'pointer',
              fontFamily: '"DM Sans", sans-serif',
            }}
          >
            ADD
          </button>
        )}
      </div>
    </form>
  )
}

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    style={{ color: 'var(--text-secondary)', flexShrink: 0 }}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
