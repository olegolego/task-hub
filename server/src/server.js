const http = require('http')
const { WebSocketServer } = require('ws')
const path = require('path')
const fs = require('fs')
const database = require('./db/database')
const { initDb, getDataDir } = database
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

  const uploadsDir = path.join(getDataDir(), 'uploads')
  const companyFilesDir = path.join(getDataDir(), 'company-files')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  if (!fs.existsSync(companyFilesDir)) fs.mkdirSync(companyFilesDir, { recursive: true })

  const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'X-User-Id, Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    // POST /upload — receive encrypted file blob
    if (req.method === 'POST' && req.url?.startsWith('/upload')) {
      const userId = req.headers['x-user-id']
      const user = userId && db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(userId)
      if (!user) { res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return }

      const params = new URL(req.url, 'http://localhost').searchParams
      const fileName = params.get('name') || 'file'
      const mimeType = params.get('mime') || 'application/octet-stream'
      const fileSize = parseInt(params.get('size') || '0', 10)

      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const buf = Buffer.concat(chunks)
        const fileId = uuidv4()
        const storedPath = path.join(uploadsDir, fileId)
        fs.writeFileSync(storedPath, buf)
        db.prepare('INSERT INTO files (id, original_name, size, mime_type, stored_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)').run(fileId, fileName, fileSize || buf.length, mimeType, storedPath, userId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ fileId }))
      })
      req.on('error', () => { res.writeHead(500); res.end() })
      return
    }

    // GET /files/:id — serve encrypted file blob
    const fileMatch = req.url?.match(/^\/files\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && fileMatch) {
      const fileId = fileMatch[1]
      const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId)
      if (!file || !fs.existsSync(file.stored_path)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(file.stored_path).size })
      fs.createReadStream(file.stored_path).pipe(res)
      return
    }

    // POST /company-upload — upload a shared company file (plaintext, no E2E encryption)
    if (req.method === 'POST' && req.url?.startsWith('/company-upload')) {
      const userId = req.headers['x-user-id']
      const user = userId && db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(userId)
      if (!user) { res.writeHead(401); res.end(); return }

      const params = new URL(req.url, 'http://localhost').searchParams
      const fileName = params.get('name') || 'file'
      const mimeType = params.get('mime') || 'application/octet-stream'
      const fileSize = parseInt(params.get('size') || '0', 10)
      const folder = params.get('folder') || 'General'

      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const buf = Buffer.concat(chunks)
        const fileId = uuidv4()
        const storedPath = path.join(companyFilesDir, fileId)
        fs.writeFileSync(storedPath, buf)
        const uploader = db.prepare('SELECT display_name, avatar_color FROM users WHERE id = ?').get(userId)
        db.prepare('INSERT INTO company_files (id, name, size, mime_type, folder, stored_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(fileId, fileName, fileSize || buf.length, mimeType, folder, storedPath, userId)
        const fileRecord = { id: fileId, name: fileName, size: fileSize || buf.length, mimeType, folder, createdAt: new Date().toISOString(), uploaderName: uploader?.display_name, uploaderColor: uploader?.avatar_color }
        // Broadcast to all clients
        const broadcastMsg = JSON.stringify({ type: 'files:uploaded', file: fileRecord })
        for (const [ws] of clients) { if (ws.readyState === 1) ws.send(broadcastMsg) }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ fileId, file: fileRecord }))
      })
      req.on('error', () => { res.writeHead(500); res.end() })
      return
    }

    // GET /company-files/:id — serve company file
    const companyFileMatch = req.url?.match(/^\/company-files\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && companyFileMatch) {
      const file = db.prepare('SELECT * FROM company_files WHERE id = ?').get(companyFileMatch[1])
      if (!file || !fs.existsSync(file.stored_path)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        'Content-Length': fs.statSync(file.stored_path).size,
      })
      fs.createReadStream(file.stored_path).pipe(res)
      return
    }

    res.writeHead(404); res.end()
  })
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
            const approvedUser = database.db.prepare('SELECT id, display_name, avatar_color, role, enc_public_key FROM users WHERE id = ?').get(targetId)
            broadcast({ type: MESSAGE_TYPES.USER_APPROVED, userId: targetId, user: approvedUser })
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

  // Pending group invites for this user (they were invited and haven't responded)
  const pendingInvites = database.db.prepare(`
    SELECT gi.id, gi.group_id, gi.from_user_id, gi.type, gi.created_at,
           g.name as group_name, g.color as group_color,
           u.display_name as from_name
    FROM group_invites gi
    JOIN groups g ON g.id = gi.group_id
    JOIN users u ON u.id = gi.from_user_id
    WHERE gi.to_user_id = ? AND gi.status = 'pending'
  `).all(user.id)

  // Pending join requests for groups where this user is admin
  const pendingJoinRequests = database.db.prepare(`
    SELECT gi.id, gi.group_id, gi.to_user_id, gi.created_at,
           g.name as group_name, u.display_name as requester_name, u.avatar_color as requester_color
    FROM group_invites gi
    JOIN groups g ON g.id = gi.group_id
    JOIN users u ON u.id = gi.to_user_id
    WHERE gi.type = 'join_request' AND gi.status = 'pending'
      AND gi.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND role = 'admin')
  `).all(user.id)

  ws.send(JSON.stringify({
    type: MESSAGE_TYPES.SYNC_RESPONSE,
    data: { tasks, groups, users, onlineUsers, ideas, pendingUsers, pendingInvites, pendingJoinRequests },
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
