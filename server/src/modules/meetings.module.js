const { v4: uuidv4 } = require('uuid')

let db

function init(database) {
  db = database
}

async function handle(msg, { clientInfo, ws, broadcast, clients }) {
  if (msg.type === 'meeting:create') {
    const { title, description = '', startTime, endTime, attendeeIds = [], groupId = null } = msg.payload || {}
    if (!title || !startTime || !endTime) return
    const id = uuidv4()
    db.prepare(`INSERT INTO meetings (id, title, description, start_time, end_time, created_by, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, title, description, startTime, endTime, clientInfo.id, groupId)
    // Add creator as accepted attendee
    db.prepare(`INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id, status) VALUES (?, ?, 'accepted')`).run(id, clientInfo.id)
    // Add other attendees as pending
    for (const uid of attendeeIds) {
      if (uid !== clientInfo.id) {
        db.prepare(`INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id, status) VALUES (?, ?, 'pending')`).run(id, uid)
      }
    }
    const meeting = buildMeeting(id)
    // Broadcast to all online users
    const outMsg = JSON.stringify({ type: 'meeting:created', meeting })
    for (const [ws2] of clients) {
      if (ws2.readyState === 1) ws2.send(outMsg)
    }
    return
  }

  if (msg.type === 'meeting:list') {
    const meetings = getAllMeetings()
    ws.send(JSON.stringify({ type: 'meeting:list_response', meetings }))
    return
  }

  if (msg.type === 'meeting:respond') {
    const { meetingId, status } = msg.payload || {}
    if (!meetingId || !['accepted', 'declined'].includes(status)) return
    db.prepare(`UPDATE meeting_attendees SET status = ? WHERE meeting_id = ? AND user_id = ?`).run(status, meetingId, clientInfo.id)
    const meeting = buildMeeting(meetingId)
    if (meeting) {
      const outMsg = JSON.stringify({ type: 'meeting:updated', meeting })
      for (const [ws2] of clients) {
        if (ws2.readyState === 1) ws2.send(outMsg)
      }
    }
    return
  }

  if (msg.type === 'meeting:delete') {
    const { meetingId } = msg.payload || {}
    if (!meetingId) return
    const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId)
    if (!meeting) return
    if (meeting.created_by !== clientInfo.id && clientInfo.role !== 'admin') {
      ws.send(JSON.stringify({ type: 'error', error: 'Permission denied' }))
      return
    }
    db.prepare('DELETE FROM meeting_attendees WHERE meeting_id = ?').run(meetingId)
    db.prepare('DELETE FROM meetings WHERE id = ?').run(meetingId)
    const outMsg = JSON.stringify({ type: 'meeting:deleted', meetingId })
    for (const [ws2] of clients) {
      if (ws2.readyState === 1) ws2.send(outMsg)
    }
    return
  }
}

function buildMeeting(meetingId) {
  const m = db.prepare('SELECT m.*, u.display_name as creatorName, u.avatar_color as creatorColor FROM meetings m JOIN users u ON u.id = m.created_by WHERE m.id = ?').get(meetingId)
  if (!m) return null
  const attendees = db.prepare(`
    SELECT ma.user_id as userId, ma.status, u.display_name as name, u.avatar_color as color
    FROM meeting_attendees ma JOIN users u ON u.id = ma.user_id
    WHERE ma.meeting_id = ?
  `).all(meetingId)
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    startTime: m.start_time,
    endTime: m.end_time,
    createdBy: m.created_by,
    creatorName: m.creatorName,
    creatorColor: m.creatorColor,
    groupId: m.group_id,
    createdAt: m.created_at,
    attendees,
  }
}

function getAllMeetings() {
  const rows = db.prepare('SELECT id FROM meetings ORDER BY start_time ASC').all()
  return rows.map(r => buildMeeting(r.id)).filter(Boolean)
}

module.exports = {
  name: 'meetings',
  messageTypes: ['meeting:create', 'meeting:list', 'meeting:respond', 'meeting:delete'],
  init,
  handle,
}
