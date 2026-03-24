import { v4 as uuidv4 } from 'uuid'
import type { ServerModule, ModuleContext } from './types.js'

const groupChatModule: ServerModule = {
  name: 'groupChat',
  messageTypes: ['group:message', 'group:history'],

  init(_db) {},

  async handle(msg, ctx: ModuleContext) {
    const { clientInfo, ws, clients, db } = ctx

    if (msg.type === 'group:message') {
      const p = msg.payload as { groupId?: string; body?: string } | undefined
      if (!p?.groupId || !p?.body) return

      const isMember = db
        .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
        .get(p.groupId, clientInfo.id)
      if (!isMember) return

      const id = uuidv4()
      db.prepare(
        'INSERT INTO group_messages (id, group_id, from_user_id, body) VALUES (?, ?, ?, ?)',
      ).run(id, p.groupId, clientInfo.id, p.body)

      const record = {
        id,
        groupId: p.groupId,
        fromUserId: clientInfo.id,
        fromName: clientInfo.displayName,
        fromColor: clientInfo.avatarColor,
        body: p.body,
        createdAt: new Date().toISOString(),
      }

      const members = db
        .prepare('SELECT user_id FROM group_members WHERE group_id = ?')
        .all(p.groupId) as { user_id: string }[]
      const memberIds = new Set(members.map((m) => m.user_id))
      const outMsg = JSON.stringify({ type: 'group:message_received', message: record })
      for (const [ws2, info] of clients) {
        if (memberIds.has(info.id) && ws2.readyState === 1) ws2.send(outMsg)
      }
    }

    if (msg.type === 'group:history') {
      const p = msg.payload as { groupId?: string; limit?: number } | undefined
      if (!p?.groupId) return

      const limit = p.limit ?? 50
      const messages = db
        .prepare(
          `
        SELECT gm.id, gm.group_id as groupId, gm.from_user_id as fromUserId, gm.body,
               gm.created_at as createdAt, u.display_name as fromName, u.avatar_color as fromColor
        FROM group_messages gm JOIN users u ON u.id = gm.from_user_id
        WHERE gm.group_id = ? ORDER BY gm.created_at DESC LIMIT ?
      `,
        )
        .all(p.groupId, limit) as Record<string, unknown>[]

      messages.reverse()
      ws.send(JSON.stringify({ type: 'group:history_response', groupId: p.groupId, messages }))
    }
  },
}

export default groupChatModule
