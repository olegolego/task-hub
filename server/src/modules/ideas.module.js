const { v4: uuidv4 } = require('uuid')

const ideasModule = {
  name: 'ideas',
  messageTypes: ['idea:post', 'idea:vote', 'idea:comment', 'idea:comments_load', 'idea:status', 'idea:delete'],

  init(db) {},

  async handle(message, { broadcast, broadcastToGroup, clients, clientInfo, ws, db }) {
    const { type, payload } = message

    if (type === 'idea:post') {
      const idea = {
        id: payload.id || uuidv4(),
        title: payload.title,
        body: payload.body || null,
        created_by: clientInfo.id,
        group_id: payload.groupId || null,
        category: payload.category || 'general',
      }

      db.prepare(`
        INSERT INTO ideas (id, title, body, created_by, group_id, category)
        VALUES (@id, @title, @body, @created_by, @group_id, @category)
      `).run(idea)

      const created = db.prepare('SELECT * FROM ideas WHERE id = ?').get(idea.id)
      const outMsg = { type: 'idea:posted', idea: { ...created, vote_count: 0, comment_count: 0 } }

      if (idea.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'idea:vote') {
      const { ideaId, vote } = payload // vote: 1 or -1

      db.prepare(`
        INSERT INTO idea_votes (idea_id, user_id, vote) VALUES (?, ?, ?)
        ON CONFLICT(idea_id, user_id) DO UPDATE SET vote = excluded.vote
      `).run(ideaId, clientInfo.id, vote)

      const voteCount = db.prepare('SELECT COALESCE(SUM(vote), 0) as total FROM idea_votes WHERE idea_id = ?').get(ideaId)
      const outMsg = { type: 'idea:voted', ideaId, userId: clientInfo.id, vote, voteCount: voteCount.total }

      const idea = db.prepare('SELECT group_id FROM ideas WHERE id = ?').get(ideaId)
      if (idea?.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'idea:comment') {
      const comment = {
        id: uuidv4(),
        idea_id: payload.ideaId,
        user_id: clientInfo.id,
        body: payload.body,
      }

      db.prepare('INSERT INTO idea_comments (id, idea_id, user_id, body) VALUES (@id, @idea_id, @user_id, @body)').run(comment)

      // Increment comment_count on idea in sync
      const commentCount = db.prepare('SELECT COUNT(*) as c FROM idea_comments WHERE idea_id = ?').get(payload.ideaId).c
      const outMsg = {
        type: 'idea:commented',
        comment: { ...comment, displayName: clientInfo.displayName, avatarColor: clientInfo.avatarColor, created_at: new Date().toISOString() },
        commentCount,
      }
      const idea = db.prepare('SELECT group_id FROM ideas WHERE id = ?').get(payload.ideaId)
      if (idea?.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'idea:comments_load') {
      const { ideaId } = payload || {}
      if (!ideaId) return
      const comments = db.prepare(`
        SELECT ic.id, ic.idea_id, ic.user_id, ic.body, ic.created_at,
               u.display_name as displayName, u.avatar_color as avatarColor
        FROM idea_comments ic
        JOIN users u ON u.id = ic.user_id
        WHERE ic.idea_id = ?
        ORDER BY ic.created_at ASC
      `).all(ideaId)
      ws.send(JSON.stringify({ type: 'idea:comments_response', ideaId, comments }))
    }

    else if (type === 'idea:status') {
      const { ideaId, status } = payload
      db.prepare("UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, ideaId)
      const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId)
      const outMsg = { type: 'idea:updated', idea: updated }
      if (updated.group_id) broadcastToGroup(outMsg, updated.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'idea:delete') {
      const { ideaId } = payload || {}
      if (!ideaId) return
      const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId)
      if (!idea) return
      // Only creator or admin can delete
      if (idea.created_by !== clientInfo.id && clientInfo.role !== 'admin') {
        ws.send(JSON.stringify({ type: 'error', error: 'Only the author or an admin can delete an idea' }))
        return
      }
      db.prepare('DELETE FROM ideas WHERE id = ?').run(ideaId)
      const outMsg = { type: 'idea:deleted', ideaId }
      if (idea.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    }
  },
}

module.exports = ideasModule
