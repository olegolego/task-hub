const presenceModule = {
  name: 'presence',
  messageTypes: ['user:status', 'user:list'],

  init(db) {},

  async handle(message, { broadcast, clients, clientInfo, ws, db }) {
    if (message.type === 'user:status') {
      broadcast({ type: 'user:status', userId: clientInfo.id, status: message.payload.status }, ws)
    }

    if (message.type === 'user:list') {
      const onlineIds = new Set([...clients.values()].map(c => c.id))
      const users = db.prepare(`
        SELECT id, display_name, email, role, avatar_color, last_seen_at
        FROM users WHERE status = 'active'
        ORDER BY display_name ASC
      `).all()

      const result = users.map(u => ({ ...u, online: onlineIds.has(u.id) }))
      ws.send(JSON.stringify({ type: 'user:list_response', users: result }))
    }
  },
}

module.exports = presenceModule
