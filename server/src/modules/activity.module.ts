import { v4 as uuidv4 } from 'uuid'
import { createLogger } from '../utils/logger.js'
import type { ServerModule, ModuleContext } from './types.js'
import type Database from 'better-sqlite3'

const log = createLogger('activity')

/**
 * Log an activity entry. Called by other modules.
 */
export function logActivity(
  db: Database.Database,
  actorId: string,
  messageType: string,
  targetType: string | null,
  targetId: string | null,
  summary: string,
  groupId: string | null = null,
) {
  try {
    db.prepare(
      `INSERT INTO activity_log (id, message_type, actor_id, target_type, target_id, summary, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(uuidv4(), messageType, actorId, targetType, targetId, summary, groupId)
  } catch (err) {
    log.error('Failed to log activity', (err as Error).message)
  }
}

const activityModule: ServerModule = {
  name: 'activity',
  messageTypes: ['activity:list'],

  init(_db) {},

  async handle(message, ctx: ModuleContext) {
    const { type, payload } = message
    const { ws, db, clientInfo } = ctx

    if (type === 'activity:list') {
      const limit = (payload as { limit?: number })?.limit || 50
      const offset = (payload as { offset?: number })?.offset || 0

      const activities = db
        .prepare(
          `SELECT a.*, u.display_name as actor_name, u.avatar_color as actor_color
           FROM activity_log a
           LEFT JOIN users u ON u.id = a.actor_id
           WHERE a.group_id IS NULL OR a.group_id IN (
             SELECT group_id FROM group_members WHERE user_id = ?
           )
           ORDER BY a.created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .all(clientInfo.id, limit, offset)

      ws.send(
        JSON.stringify({
          type: 'activity:list_response',
          activities,
        }),
      )
    }
  },
}

export default activityModule
