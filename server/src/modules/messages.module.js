const { v4: uuidv4 } = require('uuid')
const { MESSAGE_TYPES } = require('@task-hub/shared')

let db

function init(database) {
  db = database
}

function getReactions(dmId) {
  return db.prepare(`
    SELECT emoji, user_id as userId FROM dm_reactions WHERE dm_id = ?
  `).all(dmId)
}

async function handle(msg, { clientInfo, ws, clients }) {
  if (msg.type === MESSAGE_TYPES.DM_SEND) {
    const { toUserId, encrypted, nonce, fileId, fileName, fileSize, mimeType, encFileKey, fileKeyNonce } = msg.payload || {}
    const isFileDM = !!fileId
    const isTextDM = !!encrypted && !!nonce

    if (!toUserId || (!isTextDM && !isFileDM)) {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Invalid DM payload' }))
      return
    }

    const recipient = db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(toUserId)
    if (!recipient) {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Recipient not found' }))
      return
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO direct_messages (id, from_user, to_user, encrypted, nonce, file_id, file_name, file_size, mime_type, enc_file_key, file_key_nonce)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, clientInfo.id, toUserId,
      encrypted || '', nonce || '',
      fileId || null, fileName || null, fileSize || null, mimeType || null,
      encFileKey || null, fileKeyNonce || null)

    const dmRecord = {
      id, fromUserId: clientInfo.id, toUserId,
      ...(isTextDM ? { encrypted, nonce } : {}),
      ...(isFileDM ? { fileId, fileName, fileSize, mimeType, encFileKey, fileKeyNonce } : {}),
      reactions: [],
      createdAt: new Date().toISOString(),
    }

    for (const [targetWs, info] of clients) {
      if (info.id === toUserId && targetWs.readyState === 1) {
        targetWs.send(JSON.stringify({ type: MESSAGE_TYPES.DM_RECEIVED, dm: dmRecord }))
        break
      }
    }
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.DM_RECEIVED, dm: dmRecord }))
    return
  }

  if (msg.type === MESSAGE_TYPES.DM_HISTORY) {
    const { withUserId, limit = 50 } = msg.payload || {}
    if (!withUserId) return

    const messages = db.prepare(`
      SELECT id, from_user as fromUserId, to_user as toUserId,
             encrypted, nonce, file_id as fileId, file_name as fileName,
             file_size as fileSize, mime_type as mimeType,
             enc_file_key as encFileKey, file_key_nonce as fileKeyNonce,
             deleted_at as deletedAt, created_at as createdAt
      FROM direct_messages
      WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
      ORDER BY created_at DESC
      LIMIT ?
    `).all(clientInfo.id, withUserId, withUserId, clientInfo.id, limit)

    messages.reverse()

    // Attach reactions to each message
    for (const m of messages) {
      m.reactions = getReactions(m.id)
    }

    ws.send(JSON.stringify({ type: MESSAGE_TYPES.DM_HISTORY_RESPONSE, withUserId, messages }))
    return
  }

  // ── Edit a message ───────────────────────────────────────────────────────
  if (msg.type === 'dm:edit') {
    const { dmId, encrypted, nonce } = msg.payload || {}
    if (!dmId || !encrypted || !nonce) return
    const dm = db.prepare('SELECT from_user, to_user, deleted_at FROM direct_messages WHERE id = ?').get(dmId)
    if (!dm || dm.from_user !== clientInfo.id || dm.deleted_at) {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Cannot edit this message' }))
      return
    }
    db.prepare("UPDATE direct_messages SET encrypted = ?, nonce = ?, edited_at = datetime('now') WHERE id = ?").run(encrypted, nonce, dmId)
    const editedMsg = JSON.stringify({ type: 'dm:edited', dmId, encrypted, nonce, fromUserId: dm.from_user, toUserId: dm.to_user })
    ws.send(editedMsg)
    for (const [targetWs, info] of clients) {
      if (info.id === dm.to_user && targetWs.readyState === 1) { targetWs.send(editedMsg); break }
    }
    return
  }

  // ── Delete a message ─────────────────────────────────────────────────────
  if (msg.type === 'dm:delete') {
    const { dmId } = msg.payload || {}
    if (!dmId) return
    const dm = db.prepare('SELECT from_user, to_user FROM direct_messages WHERE id = ?').get(dmId)
    if (!dm || dm.from_user !== clientInfo.id) {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Cannot delete this message' }))
      return
    }
    db.prepare("UPDATE direct_messages SET deleted_at = datetime('now') WHERE id = ?").run(dmId)
    const deletedMsg = JSON.stringify({ type: 'dm:deleted', dmId })
    ws.send(deletedMsg)
    // Notify the other party
    for (const [targetWs, info] of clients) {
      if (info.id === dm.to_user && targetWs.readyState === 1) { targetWs.send(deletedMsg); break }
    }
    return
  }

  // ── Emoji reaction ────────────────────────────────────────────────────────
  if (msg.type === 'dm:react') {
    const { dmId, emoji } = msg.payload || {}
    if (!dmId || !emoji) return
    const dm = db.prepare('SELECT from_user, to_user FROM direct_messages WHERE id = ?').get(dmId)
    if (!dm) return

    // Toggle: if already reacted with this emoji, remove; otherwise add
    const existing = db.prepare('SELECT 1 FROM dm_reactions WHERE dm_id = ? AND user_id = ? AND emoji = ?').get(dmId, clientInfo.id, emoji)
    if (existing) {
      db.prepare('DELETE FROM dm_reactions WHERE dm_id = ? AND user_id = ? AND emoji = ?').run(dmId, clientInfo.id, emoji)
    } else {
      db.prepare('INSERT OR IGNORE INTO dm_reactions (dm_id, user_id, emoji) VALUES (?, ?, ?)').run(dmId, clientInfo.id, emoji)
    }

    const reactions = getReactions(dmId)
    const reactionMsg = JSON.stringify({ type: 'dm:reaction', dmId, reactions })
    ws.send(reactionMsg)
    const otherId = dm.from_user === clientInfo.id ? dm.to_user : dm.from_user
    for (const [targetWs, info] of clients) {
      if (info.id === otherId && targetWs.readyState === 1) { targetWs.send(reactionMsg); break }
    }
    return
  }
}

module.exports = {
  name: 'messages',
  messageTypes: ['dm:send', 'dm:history', 'dm:delete', 'dm:edit', 'dm:react'],
  init,
  handle,
}
