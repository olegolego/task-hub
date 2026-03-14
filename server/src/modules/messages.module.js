const { v4: uuidv4 } = require('uuid')
const { MESSAGE_TYPES } = require('@task-hub/shared')

let db

function init(database) {
  db = database
}

async function handle(msg, { clientInfo, ws, clients }) {
  if (msg.type === MESSAGE_TYPES.DM_SEND) {
    const { toUserId, encrypted, nonce } = msg.payload || {}
    if (!toUserId || !encrypted || !nonce) {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Invalid DM payload' }))
      return
    }

    // Recipient must exist and be active
    const recipient = db.prepare("SELECT id, enc_public_key FROM users WHERE id = ? AND status = 'active'").get(toUserId)
    if (!recipient) {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Recipient not found' }))
      return
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO direct_messages (id, from_user, to_user, encrypted, nonce)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, clientInfo.id, toUserId, encrypted, nonce)

    const dmRecord = {
      id,
      fromUserId: clientInfo.id,
      toUserId,
      encrypted,
      nonce,
      createdAt: new Date().toISOString(),
    }

    // Relay to recipient if online
    for (const [targetWs, info] of clients) {
      if (info.id === toUserId && targetWs.readyState === 1) {
        targetWs.send(JSON.stringify({ type: MESSAGE_TYPES.DM_RECEIVED, dm: dmRecord }))
        break
      }
    }

    // Echo back to sender so they see their own sent message
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.DM_RECEIVED, dm: dmRecord }))
    return
  }

  if (msg.type === MESSAGE_TYPES.DM_HISTORY) {
    const { withUserId, limit = 50 } = msg.payload || {}
    if (!withUserId) return

    const messages = db.prepare(`
      SELECT id, from_user as fromUserId, to_user as toUserId, encrypted, nonce, created_at as createdAt
      FROM direct_messages
      WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
      ORDER BY created_at DESC
      LIMIT ?
    `).all(clientInfo.id, withUserId, withUserId, clientInfo.id, limit)

    // Return in chronological order
    messages.reverse()

    ws.send(JSON.stringify({
      type: MESSAGE_TYPES.DM_HISTORY_RESPONSE,
      withUserId,
      messages,
    }))
  }
}

module.exports = {
  name: 'messages',
  messageTypes: ['dm:send', 'dm:history'],
  init,
  handle,
}
