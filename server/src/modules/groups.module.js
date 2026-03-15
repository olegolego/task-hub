const { v4: uuidv4 } = require('uuid')
const { GROUP_COLORS } = require('@task-hub/shared')

const groupsModule = {
  name: 'groups',
  messageTypes: [
    'group:create', 'group:join', 'group:leave',
    'group:invite', 'group:invite_respond',
    'group:join_respond', 'group:members',
  ],

  init(db) {},

  async handle(message, { broadcast, broadcastToGroup, clients, clientInfo, ws, db }) {
    const { type, payload } = message

    // ── Create ──────────────────────────────────────────────────────────────
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
      db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')").run(group.id, clientInfo.id)
      const created = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id)
      broadcast({ type: 'group:created', group: created })
    }

    // ── Join (request — requires admin approval) ─────────────────────────────
    else if (type === 'group:join') {
      const { groupId } = payload || {}
      if (!groupId) return

      const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
      if (!group) { ws.send(JSON.stringify({ type: 'error', error: 'Group not found' })); return }

      // Already a member?
      const already = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, clientInfo.id)
      if (already) { ws.send(JSON.stringify({ type: 'error', error: 'Already a member' })); return }

      // Already pending?
      const alreadyPending = db.prepare("SELECT 1 FROM group_invites WHERE group_id = ? AND to_user_id = ? AND type = 'join_request' AND status = 'pending'").get(groupId, clientInfo.id)
      if (alreadyPending) { ws.send(JSON.stringify({ type: 'error', error: 'Join request already pending' })); return }

      const inviteId = uuidv4()
      db.prepare("INSERT INTO group_invites (id, group_id, from_user_id, to_user_id, type) VALUES (?, ?, ?, ?, 'join_request')").run(inviteId, groupId, clientInfo.id, clientInfo.id)

      // Notify all online group admins
      const admins = db.prepare("SELECT user_id FROM group_members WHERE group_id = ? AND role = 'admin'").all(groupId)
      const adminIds = new Set(admins.map(a => a.user_id))
      const joinReqMsg = JSON.stringify({
        type: 'group:join_requested',
        inviteId,
        groupId,
        groupName: group.name,
        groupColor: group.color,
        requesterId: clientInfo.id,
        requesterName: clientInfo.displayName,
        requesterColor: clientInfo.avatarColor,
      })
      for (const [targetWs, info] of clients) {
        if (adminIds.has(info.id) && targetWs.readyState === 1) targetWs.send(joinReqMsg)
      }
      ws.send(JSON.stringify({ type: 'group:join_pending', groupName: group.name }))
    }

    // ── Leave ────────────────────────────────────────────────────────────────
    else if (type === 'group:leave') {
      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(payload.groupId, clientInfo.id)
      broadcastToGroup({ type: 'group:member_left', groupId: payload.groupId, userId: clientInfo.id }, payload.groupId)
    }

    // ── Invite (creates pending invite — invitee must accept) ────────────────
    else if (type === 'group:invite') {
      const { groupId, userId: targetId } = payload || {}
      if (!groupId || !targetId) return

      const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, clientInfo.id)
      if (!isMember) { ws.send(JSON.stringify({ type: 'error', error: 'You are not in this group' })); return }

      const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
      if (!group) return

      // Already a member?
      const alreadyMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, targetId)
      if (alreadyMember) return

      // Already has pending invite?
      const alreadyInvited = db.prepare("SELECT 1 FROM group_invites WHERE group_id = ? AND to_user_id = ? AND type = 'invite' AND status = 'pending'").get(groupId, targetId)
      if (alreadyInvited) return

      const inviteId = uuidv4()
      db.prepare("INSERT INTO group_invites (id, group_id, from_user_id, to_user_id, type) VALUES (?, ?, ?, ?, 'invite')").run(inviteId, groupId, clientInfo.id, targetId)

      // Notify target if online
      const inviteMsg = JSON.stringify({
        type: 'group:invite_received',
        inviteId,
        groupId,
        groupName: group.name,
        groupColor: group.color,
        fromId: clientInfo.id,
        fromName: clientInfo.displayName,
      })
      for (const [targetWs, info] of clients) {
        if (info.id === targetId && targetWs.readyState === 1) { targetWs.send(inviteMsg); break }
      }
    }

    // ── Invite respond (invitee accepts or declines) ─────────────────────────
    else if (type === 'group:invite_respond') {
      const { inviteId, accept } = payload || {}
      if (!inviteId) return

      const invite = db.prepare("SELECT * FROM group_invites WHERE id = ? AND to_user_id = ? AND type = 'invite' AND status = 'pending'").get(inviteId, clientInfo.id)
      if (!invite) { ws.send(JSON.stringify({ type: 'error', error: 'Invite not found' })); return }

      db.prepare("UPDATE group_invites SET status = ? WHERE id = ?").run(accept ? 'accepted' : 'declined', inviteId)

      if (accept) {
        db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)").run(invite.group_id, clientInfo.id)
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(invite.group_id)
        const groupTasks = db.prepare('SELECT * FROM tasks WHERE group_id = ? ORDER BY sort_order ASC, created_at DESC').all(invite.group_id)
        const members = db.prepare(`
          SELECT u.id, u.display_name, u.avatar_color, gm.role
          FROM group_members gm JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?
        `).all(invite.group_id)

        // Send full group data to the newly joined user
        ws.send(JSON.stringify({ type: 'group:invited', group, tasks: groupTasks, members }))

        // Notify everyone in group
        broadcast({ type: 'group:member_joined', groupId: invite.group_id, userId: clientInfo.id, displayName: clientInfo.displayName })
      }
    }

    // ── Join request respond (group admin approves or declines) ──────────────
    else if (type === 'group:join_respond') {
      const { inviteId, accept } = payload || {}
      if (!inviteId) return

      const invite = db.prepare("SELECT * FROM group_invites WHERE id = ? AND type = 'join_request' AND status = 'pending'").get(inviteId)
      if (!invite) { ws.send(JSON.stringify({ type: 'error', error: 'Request not found' })); return }

      // Only group admins can respond
      const isAdmin = db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'").get(invite.group_id, clientInfo.id)
      if (!isAdmin) { ws.send(JSON.stringify({ type: 'error', error: 'Not a group admin' })); return }

      db.prepare("UPDATE group_invites SET status = ? WHERE id = ?").run(accept ? 'accepted' : 'declined', inviteId)

      const requesterId = invite.to_user_id

      if (accept) {
        db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)").run(invite.group_id, requesterId)
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(invite.group_id)
        const groupTasks = db.prepare('SELECT * FROM tasks WHERE group_id = ? ORDER BY sort_order ASC, created_at DESC').all(invite.group_id)
        const members = db.prepare(`
          SELECT u.id, u.display_name, u.avatar_color, gm.role
          FROM group_members gm JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?
        `).all(invite.group_id)

        // Notify requester if online
        const joinedMsg = JSON.stringify({ type: 'group:invited', group, tasks: groupTasks, members })
        for (const [targetWs, info] of clients) {
          if (info.id === requesterId && targetWs.readyState === 1) { targetWs.send(joinedMsg); break }
        }

        // Notify group members
        const requesterName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(requesterId)?.display_name
        broadcast({ type: 'group:member_joined', groupId: invite.group_id, userId: requesterId, displayName: requesterName })
      } else {
        // Notify requester of decline if online
        const declinedMsg = JSON.stringify({ type: 'group:join_declined', groupId: invite.group_id })
        for (const [targetWs, info] of clients) {
          if (info.id === requesterId && targetWs.readyState === 1) { targetWs.send(declinedMsg); break }
        }
      }

      // Tell admin to remove this request from their UI
      ws.send(JSON.stringify({ type: 'group:join_request_resolved', inviteId }))
    }

    // ── Members list ─────────────────────────────────────────────────────────
    else if (type === 'group:members') {
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
