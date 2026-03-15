import React, { useEffect, useRef, useState } from 'react'
import { useMeetingsStore } from '../../store/meetingsStore'
import { useUserStore } from '../../store/userStore'
import { useConnectionStore } from '../../store/connectionStore'

// ─── Web Audio chime ─────────────────────────────────────────────────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15)
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.5)
    })
  } catch (e) {
    // AudioContext may be blocked until user interaction
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day) // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatTime(ms) {
  const d = new Date(ms)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ms) {
  const d = new Date(ms)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateInput(ms) {
  const d = new Date(ms)
  return d.toISOString().slice(0, 10)
}

function formatTimeInput(ms) {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_START = 8  // 8am
const HOUR_END = 20   // 8pm
const HOUR_HEIGHT = 60 // px per hour
const GRID_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT // 720px

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 22 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#555',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 32, right: 24, zIndex: 9999,
      background: 'var(--accent)', color: '#1a1a2e',
      padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span>🔔</span>
      {message}
    </div>
  )
}

// ─── Create Meeting Modal ─────────────────────────────────────────────────────
function CreateMeetingModal({ onClose }) {
  const { createMeeting } = useMeetingsStore()
  const users = useUserStore((s) => s.users)
  const myUser = useConnectionStore((s) => s.myUser)

  const now = new Date()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(formatDateInput(now))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [attendeeIds, setAttendeeIds] = useState([])

  function toggleAttendee(id) {
    setAttendeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const startMs = new Date(`${date}T${startTime}`).getTime()
    const endMs = new Date(`${date}T${endTime}`).getTime()
    if (endMs <= startMs) { alert('End time must be after start time.'); return }
    createMeeting({ title: title.trim(), description: description.trim(), startTime: startMs, endTime: endMs, attendeeIds, groupId: null })
    onClose(startMs)
  }

  const otherUsers = users.filter(u => u.id !== myUser?.id)

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, color: 'var(--text-primary)', padding: '7px 10px',
    fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--surface)', borderRadius: 10, padding: 24, width: 420,
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>New Meeting</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title *</label>
          <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title" required />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 54 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional agenda or notes" />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</label>
            <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</label>
            <input type="time" style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</label>
            <input type="time" style={inputStyle} value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>

        {otherUsers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invite Attendees</label>
            <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {otherUsers.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: attendeeIds.includes(u.id) ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                  <input type="checkbox" checked={attendeeIds.includes(u.id)} onChange={() => toggleAttendee(u.id)} style={{ accentColor: 'var(--accent)' }} />
                  <Avatar name={u.display_name} color={u.avatar_color} size={20} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{u.display_name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            padding: '7px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button type="submit" style={{
            padding: '7px 16px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: '#1a1a2e', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Create Meeting</button>
        </div>
      </form>
    </div>
  )
}

// ─── Meeting Detail Popover ───────────────────────────────────────────────────
function MeetingPopover({ meeting, anchorRect, onClose }) {
  const { respondToMeeting, deleteMeeting } = useMeetingsStore()
  const myUser = useConnectionStore((s) => s.myUser)
  const myId = myUser?.id

  const myAttendee = meeting.attendees?.find(a => a.userId === myId)
  const isCreator = meeting.createdBy === myId
  const isAttendee = !!myAttendee && !isCreator

  function handleRespond(status) {
    respondToMeeting(meeting.id, status)
    onClose()
  }

  function handleDelete() {
    deleteMeeting(meeting.id)
    onClose()
  }

  const statusColors = { accepted: '#06d6a0', declined: '#ef476f', pending: '#ffd166' }

  // Position popover near anchor
  const style = {
    position: 'fixed',
    top: anchorRect ? Math.min(anchorRect.bottom + 6, window.innerHeight - 260) : '50%',
    left: anchorRect ? Math.min(anchorRect.right + 8, window.innerWidth - 280) : '50%',
    zIndex: 2000,
    width: 260,
    background: 'var(--surface)',
    borderRadius: 10,
    boxShadow: '0 8px 36px rgba(0,0,0,0.55)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1999 }} onClick={onClose} />
      <div style={style}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{meeting.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {formatDate(meeting.startTime)} · {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
        </div>
        {meeting.description ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{meeting.description}</div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendees</div>
          {meeting.attendees?.map(a => (
            <div key={a.userId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar name={a.name} color={a.color} size={18} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{a.name}</span>
              <span style={{ fontSize: 10, color: statusColors[a.status] || 'var(--text-secondary)', fontWeight: 600 }}>{a.status}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isAttendee && myAttendee?.status !== 'accepted' && (
            <button onClick={() => handleRespond('accepted')} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', background: '#06d6a0', color: '#1a1a2e', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Accept</button>
          )}
          {isAttendee && myAttendee?.status !== 'declined' && (
            <button onClick={() => handleRespond('declined')} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', background: '#ef476f', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Decline</button>
          )}
          {isCreator && (
            <button onClick={handleDelete} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(247,37,133,0.4)', background: 'transparent', color: '#f72585', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Delete</button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Week Grid ────────────────────────────────────────────────────────────────
function WeekGrid({ weekStart, meetings, onMeetingClick }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)

  function getMeetingsForDay(dayDate) {
    const dayStart = new Date(dayDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayDate)
    dayEnd.setHours(23, 59, 59, 999)
    return meetings.filter(m => m.startTime <= dayEnd.getTime() && m.endTime >= dayStart.getTime())
  }

  function getBlockStyle(meeting) {
    const dayStart = new Date(meeting.startTime)
    dayStart.setHours(HOUR_START, 0, 0, 0)
    const startHour = new Date(meeting.startTime).getHours() + new Date(meeting.startTime).getMinutes() / 60
    const endHour = new Date(meeting.endTime).getHours() + new Date(meeting.endTime).getMinutes() / 60
    const clampedStart = Math.max(startHour, HOUR_START)
    const clampedEnd = Math.min(endHour, HOUR_END)
    const top = (clampedStart - HOUR_START) * HOUR_HEIGHT
    const height = Math.max((clampedEnd - clampedStart) * HOUR_HEIGHT, 20)
    return { top, height }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Day header row */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ width: 44, flexShrink: 0 }} />
        {days.map((d, i) => {
          const isToday = d.getTime() === today.getTime()
          return (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '8px 2px',
              fontSize: 12, fontWeight: isToday ? 700 : 400,
              color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
            }}>
              <div>{DAY_LABELS[i]}</div>
              <div style={{
                marginTop: 2, width: 22, height: 22, borderRadius: '50%',
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? '#1a1a2e' : 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: isToday ? 700 : 500, fontSize: 12,
              }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', minHeight: GRID_HEIGHT }}>
          {/* Hour labels */}
          <div style={{ width: 44, flexShrink: 0, position: 'relative' }}>
            {hours.map(h => (
              <div key={h} style={{
                position: 'absolute', top: (h - HOUR_START) * HOUR_HEIGHT - 7,
                right: 6, fontSize: 10, color: 'var(--text-secondary)', userSelect: 'none',
              }}>
                {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, di) => {
            const dayMeetings = getMeetingsForDay(d)
            return (
              <div key={di} style={{
                flex: 1, position: 'relative', minHeight: GRID_HEIGHT,
                borderLeft: '1px solid rgba(255,255,255,0.06)',
              }}>
                {/* Hour lines */}
                {hours.map(h => (
                  <div key={h} style={{
                    position: 'absolute', top: (h - HOUR_START) * HOUR_HEIGHT,
                    left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.05)',
                    pointerEvents: 'none',
                  }} />
                ))}

                {/* Meeting blocks */}
                {dayMeetings.map(m => {
                  const { top, height } = getBlockStyle(m)
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onMeetingClick(m, e.currentTarget.getBoundingClientRect())
                      }}
                      style={{
                        position: 'absolute', left: 2, right: 2,
                        top, height,
                        background: m.creatorColor ? `${m.creatorColor}33` : 'rgba(139,92,246,0.25)',
                        border: `1px solid ${m.creatorColor || '#8b5cf6'}66`,
                        borderRadius: 5, padding: '2px 5px',
                        overflow: 'hidden', cursor: 'pointer',
                        transition: 'filter 0.1s',
                        zIndex: 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.title}</div>
                      {height > 30 && (
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{formatTime(m.startTime)}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Upcoming Sidebar ─────────────────────────────────────────────────────────
function UpcomingList({ meetings }) {
  const now = Date.now()
  const upcoming = meetings.filter(m => m.endTime > now).slice(0, 5)

  return (
    <div style={{
      width: 210, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Upcoming</div>
      {upcoming.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No upcoming meetings</div>
      ) : upcoming.map(m => (
        <div key={m.id} style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: '8px 10px',
          borderLeft: `3px solid ${m.creatorColor || '#8b5cf6'}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{m.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatDate(m.startTime)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatTime(m.startTime)} – {formatTime(m.endTime)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
            {m.attendees?.length ?? 0} attendee{m.attendees?.length !== 1 ? 's' : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── CalendarPanel (main) ─────────────────────────────────────────────────────
export default function CalendarPanel() {
  const { meetings, loadMeetings } = useMeetingsStore()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showCreate, setShowCreate] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [selectedAnchor, setSelectedAnchor] = useState(null)
  const [toasts, setToasts] = useState([])
  const notifiedRef = useRef(new Set())

  useEffect(() => {
    loadMeetings()
  }, [])

  // 5-minute notification check
  useEffect(() => {
    function check() {
      const now = Date.now()
      for (const m of meetings) {
        if (notifiedRef.current.has(m.id)) continue
        const diff = m.startTime - now
        if (diff <= 5 * 60 * 1000 && diff > -60 * 1000) {
          notifiedRef.current.add(m.id)
          playChime()
          const id = Date.now() + Math.random()
          setToasts(prev => [...prev, { id, text: `"${m.title}" starts in ${Math.max(0, Math.round(diff / 60000))} min` }])
        }
      }
    }
    check()
    const timer = setInterval(check, 30000)
    return () => clearInterval(timer)
  }, [meetings])

  function handleMeetingClick(meeting, rect) {
    setSelectedMeeting(meeting)
    setSelectedAnchor(rect)
  }

  function goToToday() {
    setWeekStart(startOfWeek(new Date()))
  }

  const weekLabel = (() => {
    const end = addDays(weekStart, 6)
    return `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
  })()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
      }}>
        <button onClick={() => setWeekStart(w => addDays(w, -7))} style={navBtnStyle}>{'< Prev'}</button>
        <button onClick={goToToday} style={navBtnStyle}>Today</button>
        <button onClick={() => setWeekStart(w => addDays(w, 7))} style={navBtnStyle}>{'Next >'}</button>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginLeft: 4 }}>{weekLabel}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: '#1a1a2e', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}
        >
          + New Meeting
        </button>
      </div>

      {/* Body: week grid + upcoming sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <WeekGrid weekStart={weekStart} meetings={meetings} onMeetingClick={handleMeetingClick} />
        <UpcomingList meetings={meetings} />
      </div>

      {/* Modals / popovers */}
      {showCreate && <CreateMeetingModal onClose={(startMs) => {
        setShowCreate(false)
        if (startMs) setWeekStart(startOfWeek(new Date(startMs)))
      }} />}
      {selectedMeeting && (
        <MeetingPopover
          meeting={selectedMeeting}
          anchorRect={selectedAnchor}
          onClose={() => { setSelectedMeeting(null); setSelectedAnchor(null) }}
        />
      )}

      {/* Toast notifications */}
      {toasts.map(t => (
        <Toast key={t.id} message={t.text} onDone={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
      ))}
    </div>
  )
}

const navBtnStyle = {
  padding: '5px 10px', borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent', color: 'var(--text-secondary)',
  cursor: 'pointer', fontSize: 12,
}
