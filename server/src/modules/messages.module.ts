import { v4 as uuidv4 } from 'uuid'
import {
  MESSAGE_TYPES,
  sendDMSchema,
  dmHistorySchema,
  editDMSchema,
  deleteDMSchema,
  reactDMSchema,
} from '@task-hub/shared'
import { validatePayload } from '../middleware/validate.js'
import type Database from 'better-sqlite3'
import type { ServerModule, ModuleContext } from './types.js'

let db: Database.Database

function getReactions(dmId: string) {
  return db.prepare('SELECT emoji, user_id as userId FROM dm_reactions WHERE dm_id = ?').all(dmId)
}

function getBatchReactions(dmIds: string[]) {
  if (dmIds.length === 0) return new Map<string, unknown[]>()
  const placeholders = dmIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT dm_id, emoji, user_id as userId FROM dm_reactions WHERE dm_id IN (${placeholders})`,
    )
    .all(...dmIds) as { dm_id: string; emoji: string; userId: string }[]
  const map = new Map<string, unknown[]>()
  for (const row of rows) {
    if (!map.has(row.dm_id)) map.set(row.dm_id, [])
    map.get(row.dm_id)!.push({ emoji: row.emoji, userId: row.userId })
  }
  return map
}

const messagesModule: ServerModule = {
  name: 'messages',
  messageTypes: ['dm:send', 'dm:history', 'dm:delete', 'dm:edit', 'dm:react'],

  init(database) {
    db = database
  },

  async handle(msg, ctx: ModuleContext) {
    const { clientInfo, ws, clients } = ctx

    if (msg.type === MESSAGE_TYPES.DM_SEND) {
      const data = validatePayload(sendDMSchema, msg.payload, ws)
      if (!data) return

      const recipient = db
        .prepare("SELECT id FROM users WHERE id = ? AND status = 'active'")
        .get(data.toUserId)
      if (!recipient) {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Recipient not found' }))
        return
      }

      const id = uuidv4()
      db.prepare(
        `
        INSERT INTO direct_messages (id, from_user, to_user, encrypted, nonce, file_id, file_name, file_size, mime_type, enc_file_key, file_key_nonce)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        id,
        clientInfo.id,
        data.toUserId,
        data.encrypted || '',
        data.nonce || '',
        data.fileId || null,
        data.fileName || null,
        data.fileSize || null,
        data.mimeType || null,
        data.encFileKey || null,
        data.fileKeyNonce || null,
      )

      const isTextDM = !!data.encrypted && !!data.nonce
      const isFileDM = !!data.fileId
      const dmRecord = {
        id,
        fromUserId: clientInfo.id,
        toUserId: data.toUserId,
        ...(isTextDM ? { encrypted: data.encrypted, nonce: data.nonce } : {}),
        ...(isFileDM
          ? {
              fileId: data.fileId,
              fileName: data.fileName,
              fileSize: data.fileSize,
              mimeType: data.mimeType,
              encFileKey: data.encFileKey,
              fileKeyNonce: data.fileKeyNonce,
            }
          : {}),
        reactions: [],
        createdAt: new Date().toISOString(),
      }

      for (const [targetWs, info] of clients) {
        if (info.id === data.toUserId && targetWs.readyState === 1) {
          targetWs.send(JSON.stringify({ type: MESSAGE_TYPES.DM_RECEIVED, dm: dmRecord }))
          break
        }
      }
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.DM_RECEIVED, dm: dmRecord }))
      return
    }

    if (msg.type === MESSAGE_TYPES.DM_HISTORY) {
      const data = validatePayload(dmHistorySchema, msg.payload, ws)
      if (!data) return

      const messages = db
        .prepare(
          `
        SELECT id, from_user as fromUserId, to_user as toUserId,
               encrypted, nonce, file_id as fileId, file_name as fileName,
               file_size as fileSize, mime_type as mimeType,
               enc_file_key as encFileKey, file_key_nonce as fileKeyNonce,
               deleted_at as deletedAt, created_at as createdAt
        FROM direct_messages
        WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
        ORDER BY created_at DESC
        LIMIT ?
      `,
        )
        .all(clientInfo.id, data.withUserId, data.withUserId, clientInfo.id, data.limit) as (Record<
        string,
        unknown
      > & { id: string })[]

      messages.reverse()

      // Batch load reactions (fixes N+1)
      const dmIds = messages.map((m) => m.id)
      const reactionsMap = getBatchReactions(dmIds)
      for (const m of messages) {
        ;(m as Record<string, unknown>).reactions = reactionsMap.get(m.id) || []
      }

      ws.send(
        JSON.stringify({
          type: MESSAGE_TYPES.DM_HISTORY_RESPONSE,
          withUserId: data.withUserId,
          messages,
        }),
      )
      return
    }

    if (msg.type === 'dm:edit') {
      const data = validatePayload(editDMSchema, msg.payload, ws)
      if (!data) return

      const dm = db
        .prepare('SELECT from_user, to_user, deleted_at FROM direct_messages WHERE id = ?')
        .get(data.dmId) as
        | { from_user: string; to_user: string; deleted_at: string | null }
        | undefined
      if (!dm || dm.from_user !== clientInfo.id || dm.deleted_at) {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Cannot edit this message' }))
        return
      }
      db.prepare(
        "UPDATE direct_messages SET encrypted = ?, nonce = ?, edited_at = datetime('now') WHERE id = ?",
      ).run(data.encrypted, data.nonce, data.dmId)
      const editedMsg = JSON.stringify({
        type: 'dm:edited',
        dmId: data.dmId,
        encrypted: data.encrypted,
        nonce: data.nonce,
        fromUserId: dm.from_user,
        toUserId: dm.to_user,
      })
      ws.send(editedMsg)
      for (const [targetWs, info] of clients) {
        if (info.id === dm.to_user && targetWs.readyState === 1) {
          targetWs.send(editedMsg)
          break
        }
      }
      return
    }

    if (msg.type === 'dm:delete') {
      const data = validatePayload(deleteDMSchema, msg.payload, ws)
      if (!data) return

      const dm = db
        .prepare('SELECT from_user, to_user FROM direct_messages WHERE id = ?')
        .get(data.dmId) as { from_user: string; to_user: string } | undefined
      if (!dm || dm.from_user !== clientInfo.id) {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Cannot delete this message' }))
        return
      }
      db.prepare("UPDATE direct_messages SET deleted_at = datetime('now') WHERE id = ?").run(
        data.dmId,
      )
      const deletedMsg = JSON.stringify({ type: 'dm:deleted', dmId: data.dmId })
      ws.send(deletedMsg)
      for (const [targetWs, info] of clients) {
        if (info.id === dm.to_user && targetWs.readyState === 1) {
          targetWs.send(deletedMsg)
          break
        }
      }
      return
    }

    if (msg.type === 'dm:react') {
      const data = validatePayload(reactDMSchema, msg.payload, ws)
      if (!data) return

      const dm = db
        .prepare('SELECT from_user, to_user FROM direct_messages WHERE id = ?')
        .get(data.dmId) as { from_user: string; to_user: string } | undefined
      if (!dm) return

      const existing = db
        .prepare('SELECT 1 FROM dm_reactions WHERE dm_id = ? AND user_id = ? AND emoji = ?')
        .get(data.dmId, clientInfo.id, data.emoji)
      if (existing) {
        db.prepare('DELETE FROM dm_reactions WHERE dm_id = ? AND user_id = ? AND emoji = ?').run(
          data.dmId,
          clientInfo.id,
          data.emoji,
        )
      } else {
        db.prepare(
          'INSERT OR IGNORE INTO dm_reactions (dm_id, user_id, emoji) VALUES (?, ?, ?)',
        ).run(data.dmId, clientInfo.id, data.emoji)
      }

      const reactions = getReactions(data.dmId)
      const reactionMsg = JSON.stringify({ type: 'dm:reaction', dmId: data.dmId, reactions })
      ws.send(reactionMsg)
      const otherId = dm.from_user === clientInfo.id ? dm.to_user : dm.from_user
      for (const [targetWs, info] of clients) {
        if (info.id === otherId && targetWs.readyState === 1) {
          targetWs.send(reactionMsg)
          break
        }
      }
      return
    }
  },
}

export default messagesModule
