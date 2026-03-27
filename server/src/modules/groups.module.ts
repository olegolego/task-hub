import { v4 as uuidv4 } from 'uuid'
import {
  GROUP_COLORS,
  createGroupSchema,
  joinGroupSchema,
  leaveGroupSchema,
  inviteToGroupSchema,
  respondToInviteSchema,
  respondToJoinSchema,
} from '@task-hub/shared'
import { validatePayload } from '../middleware/validate.js'
import { createLogger } from '../utils/logger.js'
import type { ServerModule, ModuleContext } from './types.js'
import { z } from 'zod'

const log = createLogger('groups')

const membersSchema = z.object({ groupId: z.string() })

const groupsModule: ServerModule = {
  name: 'groups',
  messageTypes: [
    'group:create',
    'group:join',
    'group:leave',
    'group:invite',
    'group:invite_respond',
    'group:join_respond',
    'group:members',
  ],

  init(_db) {},

  async handle(message, ctx: ModuleContext) {
    const { type, payload } = message
    const { broadcast, broadcastToGroup, clients, clientInfo, ws, db } = ctx

    if (type === 'group:create') {
      const data = validatePayload(createGroupSchema, payload, ws)
      if (!data) return

      const color = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]
      const group = {
        id: uuidv4(),
        name: data.name,
        description: data.description || null,
        created_by: clientInfo.id,
        color,
      }

      const createGroup = db.transaction(() => {
        db.prepare(
          'INSERT INTO groups (id, name, description, created_by, color) VALUES (@id, @name, @description, @created_by, @color)',
        ).run(group)
        db.prepare(
          "INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')",
        ).run(group.id, clientInfo.id)
      })
      createGroup()

      const created = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id)
      broadcast({ type: 'group:created', group: created })
      log.info('Group created', { id: group.id, name: data.name })
    } else if (type === 'group:join') {
      const data = validatePayload(joinGroupSchema, payload, ws)
      if (!data) return

      const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(data.groupId) as
        | Record<string, unknown>
        | undefined
      if (!group) {
        ws.send(JSON.stringify({ type: 'error', error: 'Group not found' }))
        return
      }

      const already = db
        .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
        .get(data.groupId, clientInfo.id)
      if (already) {
        ws.send(JSON.stringify({ type: 'error', error: 'Already a member' }))
        return
      }

      const alreadyPending = db
        .prepare(
          "SELECT 1 FROM group_invites WHERE group_id = ? AND to_user_id = ? AND type = 'join_request' AND status = 'pending'",
        )
        .get(data.groupId, clientInfo.id)
      if (alreadyPending) {
        ws.send(JSON.stringify({ type: 'error', error: 'Join request already pending' }))
        return
      }

      const inviteId = uuidv4()
      db.prepare(
        "INSERT INTO group_invites (id, group_id, from_user_id, to_user_id, type) VALUES (?, ?, ?, ?, 'join_request')",
      ).run(inviteId, data.groupId, clientInfo.id, clientInfo.id)

      const admins = db
        .prepare("SELECT user_id FROM group_members WHERE group_id = ? AND role = 'admin'")
        .all(data.groupId) as { user_id: string }[]
      const adminIds = new Set(admins.map((a) => a.user_id))
      const joinReqMsg = JSON.stringify({
        type: 'group:join_requested',
        inviteId,
        groupId: data.groupId,
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
    } else if (type === 'group:leave') {
      const data = validatePayload(leaveGroupSchema, payload, ws)
      if (!data) return

      db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(
        data.groupId,
        clientInfo.id,
      )
      broadcastToGroup(
        { type: 'group:member_left', groupId: data.groupId, userId: clientInfo.id },
        data.groupId,
      )
    } else if (type === 'group:invite') {
      const data = validatePayload(inviteToGroupSchema, payload, ws)
      if (!data) return

      const isMember = db
        .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
        .get(data.groupId, clientInfo.id)
      if (!isMember) {
        ws.send(JSON.stringify({ type: 'error', error: 'You are not in this group' }))
        return
      }

      const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(data.groupId) as
        | Record<string, unknown>
        | undefined
      if (!group) return

      const alreadyMember = db
        .prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?')
        .get(data.groupId, data.userId)
      if (alreadyMember) return

      const alreadyInvited = db
        .prepare(
          "SELECT 1 FROM group_invites WHERE group_id = ? AND to_user_id = ? AND type = 'invite' AND status = 'pending'",
        )
        .get(data.groupId, data.userId)
      if (alreadyInvited) return

      const inviteId = uuidv4()
      db.prepare(
        "INSERT INTO group_invites (id, group_id, from_user_id, to_user_id, type) VALUES (?, ?, ?, ?, 'invite')",
      ).run(inviteId, data.groupId, clientInfo.id, data.userId)

      const inviteMsg = JSON.stringify({
        type: 'group:invite_received',
        inviteId,
        groupId: data.groupId,
        groupName: group.name,
        groupColor: group.color,
        fromId: clientInfo.id,
        fromName: clientInfo.displayName,
      })
      for (const [targetWs, info] of clients) {
        if (info.id === data.userId && targetWs.readyState === 1) {
          targetWs.send(inviteMsg)
          break
        }
      }
    } else if (type === 'group:invite_respond') {
      const data = validatePayload(respondToInviteSchema, payload, ws)
      if (!data) return

      const invite = db
        .prepare(
          "SELECT * FROM group_invites WHERE id = ? AND to_user_id = ? AND type = 'invite' AND status = 'pending'",
        )
        .get(data.inviteId, clientInfo.id) as Record<string, unknown> | undefined
      if (!invite) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invite not found' }))
        return
      }

      db.prepare('UPDATE group_invites SET status = ? WHERE id = ?').run(
        data.accept ? 'accepted' : 'declined',
        data.inviteId,
      )

      if (data.accept) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(
          invite.group_id,
          clientInfo.id,
        )
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(invite.group_id)
        const groupTasks = db
          .prepare(
            'SELECT * FROM tasks WHERE group_id = ? ORDER BY sort_order ASC, created_at DESC',
          )
          .all(invite.group_id)
        const members = db
          .prepare(
            `SELECT u.id, u.display_name, u.avatar_color, gm.role
          FROM group_members gm JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?`,
          )
          .all(invite.group_id)

        ws.send(JSON.stringify({ type: 'group:invited', group, tasks: groupTasks, members }))
        broadcast({
          type: 'group:member_joined',
          groupId: invite.group_id,
          userId: clientInfo.id,
          displayName: clientInfo.displayName,
        })
      }
    } else if (type === 'group:join_respond') {
      const data = validatePayload(respondToJoinSchema, payload, ws)
      if (!data) return

      const invite = db
        .prepare(
          "SELECT * FROM group_invites WHERE id = ? AND type = 'join_request' AND status = 'pending'",
        )
        .get(data.inviteId) as Record<string, unknown> | undefined
      if (!invite) {
        ws.send(JSON.stringify({ type: 'error', error: 'Request not found' }))
        return
      }

      const isAdmin = db
        .prepare(
          "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'admin'",
        )
        .get(invite.group_id, clientInfo.id)
      if (!isAdmin) {
        ws.send(JSON.stringify({ type: 'error', error: 'Not a group admin' }))
        return
      }

      db.prepare('UPDATE group_invites SET status = ? WHERE id = ?').run(
        data.accept ? 'accepted' : 'declined',
        data.inviteId,
      )

      const requesterId = invite.to_user_id as string

      if (data.accept) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(
          invite.group_id,
          requesterId,
        )
        const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(invite.group_id)
        const groupTasks = db
          .prepare(
            'SELECT * FROM tasks WHERE group_id = ? ORDER BY sort_order ASC, created_at DESC',
          )
          .all(invite.group_id)
        const members = db
          .prepare(
            `SELECT u.id, u.display_name, u.avatar_color, gm.role
          FROM group_members gm JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?`,
          )
          .all(invite.group_id)

        const joinedMsg = JSON.stringify({
          type: 'group:invited',
          group,
          tasks: groupTasks,
          members,
        })
        for (const [targetWs, info] of clients) {
          if (info.id === requesterId && targetWs.readyState === 1) {
            targetWs.send(joinedMsg)
            break
          }
        }

        const requesterName = (
          db.prepare('SELECT display_name FROM users WHERE id = ?').get(requesterId) as
            | { display_name: string }
            | undefined
        )?.display_name
        broadcast({
          type: 'group:member_joined',
          groupId: invite.group_id,
          userId: requesterId,
          displayName: requesterName,
        })
      } else {
        const declinedMsg = JSON.stringify({
          type: 'group:join_declined',
          groupId: invite.group_id,
        })
        for (const [targetWs, info] of clients) {
          if (info.id === requesterId && targetWs.readyState === 1) {
            targetWs.send(declinedMsg)
            break
          }
        }
      }

      ws.send(JSON.stringify({ type: 'group:join_request_resolved', inviteId: data.inviteId }))
    } else if (type === 'group:members') {
      const data = validatePayload(membersSchema, payload, ws)
      if (!data) return

      const members = db
        .prepare(
          `SELECT u.id, u.display_name, u.avatar_color, gm.role
        FROM group_members gm JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?`,
        )
        .all(data.groupId)
      ws.send(JSON.stringify({ type: 'group:members', groupId: data.groupId, members }))
    }
  },
}

export default groupsModule
