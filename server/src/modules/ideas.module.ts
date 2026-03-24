import { v4 as uuidv4 } from 'uuid'
import {
  postIdeaSchema,
  voteIdeaSchema,
  commentIdeaSchema,
  updateIdeaStatusSchema,
  deleteIdeaSchema,
} from '@task-hub/shared'
import { validatePayload } from '../middleware/validate.js'
import { canDeleteResource } from '../auth/permissions.js'
import { createLogger } from '../utils/logger.js'
import type { ServerModule, ModuleContext } from './types.js'

const log = createLogger('ideas')

const ideasModule: ServerModule = {
  name: 'ideas',
  messageTypes: [
    'idea:post',
    'idea:vote',
    'idea:comment',
    'idea:comments_load',
    'idea:status',
    'idea:delete',
  ],

  init(_db) {},

  async handle(message, ctx: ModuleContext) {
    const { type, payload } = message
    const { broadcast, broadcastToGroup, clientInfo, ws, db } = ctx

    if (type === 'idea:post') {
      const data = validatePayload(postIdeaSchema, payload, ws)
      if (!data) return

      const idea = {
        id: data.id || uuidv4(),
        title: data.title,
        body: data.body || null,
        created_by: clientInfo.id,
        group_id: data.groupId || null,
        category: data.category,
      }

      db.prepare(
        `
        INSERT INTO ideas (id, title, body, created_by, group_id, category)
        VALUES (@id, @title, @body, @created_by, @group_id, @category)
      `,
      ).run(idea)

      const created = db.prepare('SELECT * FROM ideas WHERE id = ?').get(idea.id) as Record<
        string,
        unknown
      >
      const outMsg = { type: 'idea:posted', idea: { ...created, vote_count: 0, comment_count: 0 } }

      if (idea.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
      log.info('Idea posted', { id: idea.id, title: idea.title })
    } else if (type === 'idea:vote') {
      const data = validatePayload(voteIdeaSchema, payload, ws)
      if (!data) return

      db.prepare(
        `
        INSERT INTO idea_votes (idea_id, user_id, vote) VALUES (?, ?, ?)
        ON CONFLICT(idea_id, user_id) DO UPDATE SET vote = excluded.vote
      `,
      ).run(data.ideaId, clientInfo.id, data.vote)

      const voteCount = db
        .prepare('SELECT COALESCE(SUM(vote), 0) as total FROM idea_votes WHERE idea_id = ?')
        .get(data.ideaId) as { total: number }
      const outMsg = {
        type: 'idea:voted',
        ideaId: data.ideaId,
        userId: clientInfo.id,
        vote: data.vote,
        voteCount: voteCount.total,
      }

      const idea = db.prepare('SELECT group_id FROM ideas WHERE id = ?').get(data.ideaId) as
        | { group_id: string | null }
        | undefined
      if (idea?.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    } else if (type === 'idea:comment') {
      const data = validatePayload(commentIdeaSchema, payload, ws)
      if (!data) return

      const comment = {
        id: uuidv4(),
        idea_id: data.ideaId,
        user_id: clientInfo.id,
        body: data.body,
      }

      db.prepare(
        'INSERT INTO idea_comments (id, idea_id, user_id, body) VALUES (@id, @idea_id, @user_id, @body)',
      ).run(comment)

      const commentCount = db
        .prepare('SELECT COUNT(*) as c FROM idea_comments WHERE idea_id = ?')
        .get(data.ideaId) as { c: number }
      const outMsg = {
        type: 'idea:commented',
        comment: {
          ...comment,
          displayName: clientInfo.displayName,
          avatarColor: clientInfo.avatarColor,
          created_at: new Date().toISOString(),
        },
        commentCount: commentCount.c,
      }
      const idea = db.prepare('SELECT group_id FROM ideas WHERE id = ?').get(data.ideaId) as
        | { group_id: string | null }
        | undefined
      if (idea?.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    } else if (type === 'idea:comments_load') {
      const p = payload as { ideaId?: string } | undefined
      const ideaId = p?.ideaId
      if (!ideaId) return
      const comments = db
        .prepare(
          `
        SELECT ic.id, ic.idea_id, ic.user_id, ic.body, ic.created_at,
               u.display_name as displayName, u.avatar_color as avatarColor
        FROM idea_comments ic
        JOIN users u ON u.id = ic.user_id
        WHERE ic.idea_id = ?
        ORDER BY ic.created_at ASC
      `,
        )
        .all(ideaId)
      ws.send(JSON.stringify({ type: 'idea:comments_response', ideaId, comments }))
    } else if (type === 'idea:status') {
      const data = validatePayload(updateIdeaStatusSchema, payload, ws)
      if (!data) return

      db.prepare("UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
        data.status,
        data.ideaId,
      )
      const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(data.ideaId) as Record<
        string,
        unknown
      >
      const outMsg = { type: 'idea:updated', idea: updated }
      if (updated?.group_id) broadcastToGroup(outMsg, updated.group_id as string)
      else broadcast(outMsg)
    } else if (type === 'idea:delete') {
      const data = validatePayload(deleteIdeaSchema, payload, ws)
      if (!data) return

      const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(data.ideaId) as
        | { created_by: string; group_id: string | null }
        | undefined
      if (!idea) return

      if (!canDeleteResource(clientInfo.id, idea.created_by, clientInfo)) {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Only the author or an admin can delete an idea',
          }),
        )
        return
      }

      db.prepare('DELETE FROM ideas WHERE id = ?').run(data.ideaId)
      const outMsg = { type: 'idea:deleted', ideaId: data.ideaId }
      if (idea.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
      log.info('Idea deleted', { id: data.ideaId })
    }
  },
}

export default ideasModule
