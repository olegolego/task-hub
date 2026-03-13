const { v4: uuidv4 } = require('uuid')

const ideasModule = {
  name: 'ideas',
  messageTypes: ['idea:post', 'idea:vote', 'idea:comment', 'idea:status'],

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

      const outMsg = { type: 'idea:commented', comment: { ...comment, displayName: clientInfo.displayName } }
      const idea = db.prepare('SELECT group_id FROM ideas WHERE id = ?').get(payload.ideaId)
      if (idea?.group_id) broadcastToGroup(outMsg, idea.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'idea:status') {
      const { ideaId, status } = payload
      db.prepare("UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, ideaId)
      const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId)
      const outMsg = { type: 'idea:updated', idea: updated }
      if (updated.group_id) broadcastToGroup(outMsg, updated.group_id)
      else broadcast(outMsg)
    }
  },
}

module.exports = ideasModule
