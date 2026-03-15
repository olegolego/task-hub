const { v4: uuidv4 } = require('uuid')

module.exports = {
  name: 'groupChat',
  messageTypes: ['group:message', 'group:history'],
  init(db) {},
  async handle(msg, { clientInfo, ws, clients, db }) {
    if (msg.type === 'group:message') {
      const { groupId, body } = msg.payload || {}
      if (!groupId || !body) return
      // Check member
      const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, clientInfo.id)
      if (!isMember) return
      const id = uuidv4()
      db.prepare('INSERT INTO group_messages (id, group_id, from_user_id, body) VALUES (?, ?, ?, ?)').run(id, groupId, clientInfo.id, body)
      const record = { id, groupId, fromUserId: clientInfo.id, fromName: clientInfo.displayName, fromColor: clientInfo.avatarColor, body, createdAt: new Date().toISOString() }
      // Broadcast to all group members online
      const members = db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId)
      const memberIds = new Set(members.map(m => m.user_id))
      const outMsg = JSON.stringify({ type: 'group:message_received', message: record })
      for (const [ws2, info] of clients) {
        if (memberIds.has(info.id) && ws2.readyState === 1) ws2.send(outMsg)
      }
    }
    if (msg.type === 'group:history') {
      const { groupId, limit = 50 } = msg.payload || {}
      if (!groupId) return
      const messages = db.prepare(`
        SELECT gm.id, gm.group_id as groupId, gm.from_user_id as fromUserId, gm.body,
               gm.created_at as createdAt, u.display_name as fromName, u.avatar_color as fromColor
        FROM group_messages gm JOIN users u ON u.id = gm.from_user_id
        WHERE gm.group_id = ? ORDER BY gm.created_at DESC LIMIT ?
      `).all(groupId, limit)
      messages.reverse()
      ws.send(JSON.stringify({ type: 'group:history_response', groupId, messages }))
    }
  }
}
