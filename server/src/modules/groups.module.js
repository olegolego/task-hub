const { v4: uuidv4 } = require('uuid')
const { GROUP_COLORS } = require('@task-hub/shared')

const groupsModule = {
  name: 'groups',
  messageTypes: ['group:create', 'group:join', 'group:leave', 'group:invite', 'group:members'],

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

    else if (type === 'group:invite') {
      const { groupId, userId: targetId } = payload || {}
      if (!groupId || !targetId) return

      // Must be a member yourself to invite
      const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, clientInfo.id)
      if (!isMember) {
        ws.send(JSON.stringify({ type: 'error', error: 'You are not in this group' }))
        return
      }

      // Get the group info
      const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
      if (!group) return

      // Add the invited user
      db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, targetId)

      // Get group tasks to send to the new member
      const groupTasks = db.prepare('SELECT * FROM tasks WHERE group_id = ? ORDER BY sort_order ASC, created_at DESC').all(groupId)
      const members = db.prepare(`
        SELECT u.id, u.display_name, u.avatar_color, u.role
        FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
      `).all(groupId)

      // Notify the invited user if they're online
      for (const [targetWs, info] of clients) {
        if (info.id === targetId && targetWs.readyState === 1) {
          targetWs.send(JSON.stringify({
            type: 'group:invited',
            group,
            tasks: groupTasks,
            members,
            invitedBy: { id: clientInfo.id, displayName: clientInfo.displayName },
          }))
          break
        }
      }

      // Notify everyone in the group that a new member joined
      broadcast({ type: 'group:member_joined', groupId, userId: targetId, displayName: db.prepare('SELECT display_name FROM users WHERE id = ?').get(targetId)?.display_name })
    }

    else if (type === 'group:members') {
      // Return current member list for a group
      const { groupId } = payload || {}
      if (!groupId) return
      const members = db.prepare(`
        SELECT u.id, u.display_name, u.avatar_color, gm.role
        FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
      `).all(groupId)
      ws.send(JSON.stringify({ type: 'group:members', groupId, members }))
    }
  },
}

module.exports = groupsModule
