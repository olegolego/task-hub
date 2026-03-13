const { v4: uuidv4 } = require('uuid')
const { GROUP_COLORS } = require('@task-hub/shared')

const groupsModule = {
  name: 'groups',
  messageTypes: ['group:create', 'group:join', 'group:leave'],

  init(db) {},

  async handle(message, { broadcast, broadcastToGroup, clients, clientInfo, ws, db }) {
    const { type, payload } = message

    if (type === 'group:create') {
      const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]
      const group = {
        id: uuidv4(),
        name: payload.name,
        description: payload.description || null,
        created_by: clientInfo.id,
        color,
      }

      db.prepare('INSERT INTO groups (id, name, description, created_by, color) VALUES (@id, @name, @description, @created_by, @color)').run(group)
      // Creator joins automatically as admin
      db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')").run(group.id, clientInfo.id)

      const created = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id)
      broadcast({ type: 'group:created', group: created })
    }

    else if (type === 'group:join') {
      try {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(payload.groupId, clientInfo.id)
        broadcast({ type: 'group:member_joined', groupId: payload.groupId, userId: clientInfo.id, displayName: clientInfo.displayName })
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: err.message }))
      }
    }

    else if (type === 'group:leave') {
      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(payload.groupId, clientInfo.id)
      broadcastToGroup({ type: 'group:member_left', groupId: payload.groupId, userId: clientInfo.id }, payload.groupId)
    }
  },
}

module.exports = groupsModule
