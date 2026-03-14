const http = require('http')
const { WebSocketServer } = require('ws')
const database = require('./db/database')
const { initDb } = database
const { moduleRegistry } = require('./modules/moduleRegistry')
const { handleAuth, verifyMessage } = require('./auth/challenge')
const { MESSAGE_TYPES } = require('@task-hub/shared')
const { v4: uuidv4 } = require('uuid')

// Track authenticated connections
// Map: ws → { userId, publicKey, displayName }
const clients = new Map()

function createServer() {
  initDb()

  // Load all modules
  const db = database.db
  moduleRegistry.loadAll(db)

  const httpServer = http.createServer()
  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    console.log('[Server] New connection from', req.socket.remoteAddress)

    // State machine: 'pending_auth' → 'authenticated'
    let state = 'pending_auth'
    let pendingChallenge = null
    let clientInfo = null

    // Send auth challenge
    const challenge = uuidv4()
    pendingChallenge = challenge
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.AUTH_CHALLENGE, challenge }))

    ws.on('message', async (data) => {
      let msg
      try {
        msg = JSON.parse(data.toString())
      } catch {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Invalid JSON' }))
        return
      }

      if (state === 'pending_auth') {
        if (msg.type === MESSAGE_TYPES.AUTH_RESPONSE) {
          const result = handleAuth(msg, pendingChallenge)
          if (result.success) {
            state = 'authenticated'
            clientInfo = result.user
            clients.set(ws, clientInfo)

            // Send success + initial data sync
            ws.send(JSON.stringify({
              type: MESSAGE_TYPES.AUTH_SUCCESS,
              user: clientInfo,
            }))

            if (clientInfo.status === 'pending') {
              // Tell the new user they're waiting for approval
              ws.send(JSON.stringify({ type: MESSAGE_TYPES.USER_PENDING }))
              // Notify all online admins about the new pending user
              broadcastToAdmins({
                type: MESSAGE_TYPES.USER_JOIN_PENDING,
                user: { id: clientInfo.id, displayName: clientInfo.displayName, avatarColor: clientInfo.avatarColor },
              })
            } else {
              // Broadcast user online
              broadcast({ type: MESSAGE_TYPES.USER_ONLINE, userId: clientInfo.id, displayName: clientInfo.displayName }, ws)
              // Send initial state
              sendInitialState(ws, clientInfo)
            }
          } else {
            ws.send(JSON.stringify({ type: MESSAGE_TYPES.AUTH_FAIL, error: result.error }))
            ws.close()
          }
        }
        return
      }

      if (state === 'authenticated') {
        // Verify message signature (skipped in dev mode)
        if (!verifyMessage(msg, clientInfo.publicKey)) {
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Invalid signature' }))
          return
        }

        // Block pending users from sending any messages
        if (clientInfo.status === 'pending') {
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.USER_PENDING }))
          return
        }

        // Admin: approve a pending user
        if (msg.type === MESSAGE_TYPES.USER_APPROVE && clientInfo.role === 'admin') {
          const targetId = msg.payload?.userId
          if (targetId) {
            database.db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(targetId)
            // Update clientInfo of target if they're online
            for (const [targetWs, info] of clients) {
              if (info.id === targetId && info.status === 'pending') {
                info.status = 'active'
                targetWs.send(JSON.stringify({ type: MESSAGE_TYPES.USER_APPROVED }))
                broadcast({ type: MESSAGE_TYPES.USER_ONLINE, userId: info.id, displayName: info.displayName }, targetWs)
                sendInitialState(targetWs, info)
                break
              }
            }
            broadcast({ type: MESSAGE_TYPES.USER_APPROVED, userId: targetId })
          }
          return
        }

        // Route to module
        const context = { broadcast, broadcastToGroup, clients, clientInfo, ws, db }
        try {
          await moduleRegistry.handle(msg, context)
        } catch (err) {
          console.error('[Server] Module error:', err)
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: err.message }))
        }
      }
    })

    ws.on('close', () => {
      if (clientInfo) {
        broadcast({ type: MESSAGE_TYPES.USER_OFFLINE, userId: clientInfo.id }, ws)
        clients.delete(ws)
        console.log('[Server] Client disconnected:', clientInfo.displayName)
      }
    })

    ws.on('error', (err) => console.error('[Server] WS error:', err))
  })

  return httpServer
}

function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message)
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data)
    }
  }
}

function broadcastToAdmins(message, excludeWs = null) {
  const data = JSON.stringify(message)
  for (const [ws, info] of clients) {
    if (ws !== excludeWs && ws.readyState === 1 && info.role === 'admin') {
      ws.send(data)
    }
  }
}

function broadcastToGroup(message, groupId, excludeWs = null) {
  // Get group member IDs
  const members = database.db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId)
  const memberIds = new Set(members.map(m => m.user_id))

  const data = JSON.stringify(message)
  for (const [ws, info] of clients) {
    if (ws !== excludeWs && ws.readyState === 1 && memberIds.has(info.id)) {
      ws.send(data)
    }
  }
}

function sendInitialState(ws, user) {
  // Send all tasks visible to this user
  const tasks = database.db.prepare(`
    SELECT * FROM tasks
    WHERE created_by = ? OR assigned_to = ? OR group_id IN (
      SELECT group_id FROM group_members WHERE user_id = ?
    )
    ORDER BY sort_order ASC, created_at DESC
  `).all(user.id, user.id, user.id)

  // Send all groups user is member of
  const groups = database.db.prepare(`
    SELECT g.*, gm.role as member_role FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `).all(user.id)

  // Send all users (for presence display + DM encryption key lookup)
  const users = database.db.prepare('SELECT id, display_name, role, avatar_color, status, enc_public_key FROM users WHERE status = ?').all('active')

  // Admins also get the pending user list
  const pendingUsers = user.role === 'admin'
    ? database.db.prepare("SELECT id, display_name, avatar_color FROM users WHERE status = 'pending'").all()
    : []
  const onlineUsers = [...clients.values()].map(c => c.id)

  // Send ideas visible to this user
  const ideas = database.db.prepare(`
    SELECT i.*,
      COALESCE(SUM(iv.vote), 0) as vote_count,
      COUNT(DISTINCT ic.id) as comment_count
    FROM ideas i
    LEFT JOIN idea_votes iv ON i.id = iv.idea_id
    LEFT JOIN idea_comments ic ON i.id = ic.idea_id
    WHERE i.group_id IS NULL OR i.group_id IN (
      SELECT group_id FROM group_members WHERE user_id = ?
    )
    GROUP BY i.id
    ORDER BY vote_count DESC, i.created_at DESC
  `).all(user.id)

  ws.send(JSON.stringify({
    type: MESSAGE_TYPES.SYNC_RESPONSE,
    data: { tasks, groups, users, onlineUsers, ideas, pendingUsers },
  }))
}

// Graceful shutdown — flush WAL to disk before exit
function shutdown() {
  try { database.db?.pragma('wal_checkpoint(TRUNCATE)') } catch {}
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

module.exports = { createServer, broadcast, broadcastToGroup, clients }
