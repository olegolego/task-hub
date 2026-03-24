import { v4 as uuidv4 } from 'uuid'
import { createMeetingSchema, rsvpMeetingSchema, deleteMeetingSchema } from '@task-hub/shared'
import { validatePayload } from '../middleware/validate.js'
import { canDeleteResource } from '../auth/permissions.js'
import { createLogger } from '../utils/logger.js'
import type Database from 'better-sqlite3'
import type { ServerModule, ModuleContext } from './types.js'

const log = createLogger('meetings')

let db: Database.Database

function buildMeeting(meetingId: string) {
  const m = db
    .prepare(
      'SELECT m.*, u.display_name as creatorName, u.avatar_color as creatorColor FROM meetings m JOIN users u ON u.id = m.created_by WHERE m.id = ?',
    )
    .get(meetingId) as Record<string, unknown> | undefined
  if (!m) return null
  const attendees = db
    .prepare(
      `
    SELECT ma.user_id as userId, ma.status, u.display_name as name, u.avatar_color as color
    FROM meeting_attendees ma JOIN users u ON u.id = ma.user_id
    WHERE ma.meeting_id = ?
  `,
    )
    .all(meetingId)
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
  const rows = db.prepare('SELECT id FROM meetings ORDER BY start_time ASC').all() as {
    id: string
  }[]
  return rows.map((r) => buildMeeting(r.id)).filter(Boolean)
}

const meetingsModule: ServerModule = {
  name: 'meetings',
  messageTypes: ['meeting:create', 'meeting:list', 'meeting:respond', 'meeting:delete'],

  init(database) {
    db = database
  },

  async handle(msg, ctx: ModuleContext) {
    const { clientInfo, ws, clients } = ctx

    if (msg.type === 'meeting:create') {
      const data = validatePayload(createMeetingSchema, msg.payload, ws)
      if (!data) return

      const id = uuidv4()

      const createMeeting = db.transaction(() => {
        db.prepare(
          'INSERT INTO meetings (id, title, description, start_time, end_time, created_by, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(
          id,
          data.title,
          data.description,
          data.startTime,
          data.endTime,
          clientInfo.id,
          data.groupId,
        )

        db.prepare(
          "INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id, status) VALUES (?, ?, 'accepted')",
        ).run(id, clientInfo.id)

        for (const uid of data.attendeeIds ?? []) {
          if (uid !== clientInfo.id) {
            db.prepare(
              "INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id, status) VALUES (?, ?, 'pending')",
            ).run(id, uid)
          }
        }
      })
      createMeeting()

      const meeting = buildMeeting(id)
      const outMsg = JSON.stringify({ type: 'meeting:created', meeting })
      for (const [ws2] of clients) {
        if (ws2.readyState === 1) ws2.send(outMsg)
      }
      log.info('Meeting created', { id, title: data.title })
      return
    }

    if (msg.type === 'meeting:list') {
      const meetings = getAllMeetings()
      ws.send(JSON.stringify({ type: 'meeting:list_response', meetings }))
      return
    }

    if (msg.type === 'meeting:respond') {
      const data = validatePayload(rsvpMeetingSchema, msg.payload, ws)
      if (!data) return

      db.prepare(
        'UPDATE meeting_attendees SET status = ? WHERE meeting_id = ? AND user_id = ?',
      ).run(data.status, data.meetingId, clientInfo.id)
      const meeting = buildMeeting(data.meetingId)
      if (meeting) {
        const outMsg = JSON.stringify({ type: 'meeting:updated', meeting })
        for (const [ws2] of clients) {
          if (ws2.readyState === 1) ws2.send(outMsg)
        }
      }
      return
    }

    if (msg.type === 'meeting:delete') {
      const data = validatePayload(deleteMeetingSchema, msg.payload, ws)
      if (!data) return

      const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(data.meetingId) as
        | { created_by: string }
        | undefined
      if (!meeting) return

      if (!canDeleteResource(clientInfo.id, meeting.created_by, clientInfo)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Permission denied' }))
        return
      }

      const deleteMeeting = db.transaction(() => {
        db.prepare('DELETE FROM meeting_attendees WHERE meeting_id = ?').run(data.meetingId)
        db.prepare('DELETE FROM meetings WHERE id = ?').run(data.meetingId)
      })
      deleteMeeting()

      const outMsg = JSON.stringify({ type: 'meeting:deleted', meetingId: data.meetingId })
      for (const [ws2] of clients) {
        if (ws2.readyState === 1) ws2.send(outMsg)
      }
      log.info('Meeting deleted', { id: data.meetingId })
      return
    }
  },
}

export default meetingsModule
