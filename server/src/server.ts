import * as http from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import * as path from 'path'
import * as fs from 'fs'
import { initDb, getDataDir, getDb } from './db/database.js'
import { moduleRegistry } from './modules/moduleRegistry.js'
import { handleAuth, verifyMessage } from './auth/challenge.js'
import { MESSAGE_TYPES } from '@task-hub/shared'
import { v4 as uuidv4 } from 'uuid'
import { checkRateLimit } from './middleware/rateLimit.js'
import { createLogger } from './utils/logger.js'
import type { ClientInfo } from './auth/permissions.js'

const log = createLogger('server')

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10) // 50MB default
const clients = new Map<WebSocket, ClientInfo>()

// Cache group member lookups to avoid re-querying on every broadcast
const groupMemberCache = new Map<string, { memberIds: Set<string>; expiresAt: number }>()
const GROUP_CACHE_TTL = 5000 // 5 seconds

export function createServer() {
  initDb()
  const db = getDb()
  moduleRegistry.loadAll(db)

  const uploadsDir = path.join(getDataDir(), 'uploads')
  const companyFilesDir = path.join(getDataDir(), 'company-files')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  if (!fs.existsSync(companyFilesDir)) fs.mkdirSync(companyFilesDir, { recursive: true })

  const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'X-User-Id, Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', clients: clients.size }))
      return
    }

    // POST /upload
    if (req.method === 'POST' && req.url?.startsWith('/upload')) {
      const userId = req.headers['x-user-id'] as string | undefined
      const user =
        userId && db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(userId)
      if (!user) {
        res.writeHead(401)
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      const params = new URL(req.url, 'http://localhost').searchParams
      const fileName = params.get('name') || 'file'
      const mimeType = params.get('mime') || 'application/octet-stream'
      const fileSize = parseInt(params.get('size') || '0', 10)

      let receivedBytes = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        receivedBytes += c.length
        if (receivedBytes > MAX_FILE_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `File exceeds maximum size of ${MAX_FILE_SIZE} bytes` }))
          req.destroy()
          return
        }
        chunks.push(c)
      })
      req.on('end', () => {
        if (receivedBytes > MAX_FILE_SIZE) return
        const buf = Buffer.concat(chunks)
        const fileId = uuidv4()
        const storedPath = path.join(uploadsDir, fileId)
        fs.writeFileSync(storedPath, buf)
        db.prepare(
          'INSERT INTO files (id, original_name, size, mime_type, stored_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(fileId, fileName, fileSize || buf.length, mimeType, storedPath, userId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ fileId }))
      })
      req.on('error', () => {
        res.writeHead(500)
        res.end()
      })
      return
    }

    // GET /files/:id
    const fileMatch = req.url?.match(/^\/files\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && fileMatch) {
      const fileId = fileMatch[1]
      const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as
        | { stored_path: string }
        | undefined
      if (!file || !fs.existsSync(file.stored_path)) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fs.statSync(file.stored_path).size,
      })
      fs.createReadStream(file.stored_path).pipe(res)
      return
    }

    // POST /company-upload
    if (req.method === 'POST' && req.url?.startsWith('/company-upload')) {
      const userId = req.headers['x-user-id'] as string | undefined
      const user =
        userId && db.prepare("SELECT id FROM users WHERE id = ? AND status = 'active'").get(userId)
      if (!user) {
        res.writeHead(401)
        res.end()
        return
      }

      const params = new URL(req.url, 'http://localhost').searchParams
      const fileName = params.get('name') || 'file'
      const mimeType = params.get('mime') || 'application/octet-stream'
      const fileSize = parseInt(params.get('size') || '0', 10)
      const folder = params.get('folder') || 'General'

      let receivedBytes = 0
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => {
        receivedBytes += c.length
        if (receivedBytes > MAX_FILE_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `File exceeds maximum size of ${MAX_FILE_SIZE} bytes` }))
          req.destroy()
          return
        }
        chunks.push(c)
      })
      req.on('end', () => {
        if (receivedBytes > MAX_FILE_SIZE) return
        const buf = Buffer.concat(chunks)
        const fileId = uuidv4()
        const storedPath = path.join(companyFilesDir, fileId)
        fs.writeFileSync(storedPath, buf)
        const uploader = db
          .prepare('SELECT display_name, avatar_color FROM users WHERE id = ?')
          .get(userId) as { display_name: string; avatar_color: string } | undefined
        db.prepare(
          'INSERT INTO company_files (id, name, size, mime_type, folder, stored_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).run(fileId, fileName, fileSize || buf.length, mimeType, folder, storedPath, userId)
        const fileRecord = {
          id: fileId,
          name: fileName,
          size: fileSize || buf.length,
          mimeType,
          folder,
          createdAt: new Date().toISOString(),
          uploaderName: uploader?.display_name,
          uploaderColor: uploader?.avatar_color,
        }
        const broadcastMsg = JSON.stringify({ type: 'files:uploaded', file: fileRecord })
        for (const [ws] of clients) {
          if (ws.readyState === 1) ws.send(broadcastMsg)
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ fileId, file: fileRecord }))
      })
      req.on('error', () => {
        res.writeHead(500)
        res.end()
      })
      return
    }

    // GET /company-files/:id
    const companyFileMatch = req.url?.match(/^\/company-files\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && companyFileMatch) {
      const file = db
        .prepare('SELECT * FROM company_files WHERE id = ?')
        .get(companyFileMatch[1]) as
        | { stored_path: string; mime_type: string; name: string }
        | undefined
      if (!file || !fs.existsSync(file.stored_path)) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        'Content-Length': fs.statSync(file.stored_path).size,
      })
      fs.createReadStream(file.stored_path).pipe(res)
      return
    }

    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    log.info(`New connection from ${req.socket.remoteAddress}`)

    let state: 'pending_auth' | 'authenticated' = 'pending_auth'
    let pendingChallenge: string | null = null
    let clientInfo: ClientInfo | null = null

    const challenge = uuidv4()
    pendingChallenge = challenge
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.AUTH_CHALLENGE, challenge }))

    ws.on('message', async (data) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(data.toString())
      } catch {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Invalid JSON' }))
        return
      }

      if (state === 'pending_auth') {
        if (msg.type === MESSAGE_TYPES.AUTH_RESPONSE) {
          const result = handleAuth(
            msg as {
              publicKey?: string
              encPublicKey?: string
              signature?: string
              displayName?: string
              challenge?: string
            },
            pendingChallenge!,
            db,
          )
          if (result.success && result.user) {
            state = 'authenticated'
            clientInfo = result.user
            clients.set(ws, clientInfo)

            ws.send(JSON.stringify({ type: MESSAGE_TYPES.AUTH_SUCCESS, user: clientInfo }))

            if (clientInfo.status === 'pending') {
              ws.send(JSON.stringify({ type: MESSAGE_TYPES.USER_PENDING }))
              broadcastToAdmins({
                type: MESSAGE_TYPES.USER_JOIN_PENDING,
                user: {
                  id: clientInfo.id,
                  displayName: clientInfo.displayName,
                  avatarColor: clientInfo.avatarColor,
                },
              })
            } else {
              broadcast(
                {
                  type: MESSAGE_TYPES.USER_ONLINE,
                  userId: clientInfo.id,
                  displayName: clientInfo.displayName,
                },
                ws,
              )
              sendInitialState(ws, clientInfo)
            }
          } else {
            ws.send(JSON.stringify({ type: MESSAGE_TYPES.AUTH_FAIL, error: result.error }))
            ws.close()
          }
        }
        return
      }

      if (state === 'authenticated' && clientInfo) {
        if (
          !verifyMessage(
            msg as {
              signature?: string
              id?: string
              type?: string
              payload?: unknown
              timestamp?: string
            },
            clientInfo.publicKey,
          )
        ) {
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Invalid signature' }))
          return
        }

        if (clientInfo.status === 'pending') {
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.USER_PENDING }))
          return
        }

        // Rate limiting
        if (!checkRateLimit(clientInfo.id, msg.type as string)) {
          ws.send(
            JSON.stringify({
              type: MESSAGE_TYPES.ERROR,
              error: 'Rate limit exceeded. Please slow down.',
            }),
          )
          return
        }

        // Admin: approve a pending user
        if (msg.type === MESSAGE_TYPES.USER_APPROVE && clientInfo.role === 'admin') {
          const targetId = (msg.payload as { userId?: string })?.userId
          if (targetId) {
            db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(targetId)
            for (const [targetWs, info] of clients) {
              if (info.id === targetId && info.status === 'pending') {
                info.status = 'active'
                targetWs.send(JSON.stringify({ type: MESSAGE_TYPES.USER_APPROVED }))
                broadcast(
                  {
                    type: MESSAGE_TYPES.USER_ONLINE,
                    userId: info.id,
                    displayName: info.displayName,
                  },
                  targetWs,
                )
                sendInitialState(targetWs, info)
                break
              }
            }
            const approvedUser = db
              .prepare(
                'SELECT id, display_name, avatar_color, role, enc_public_key FROM users WHERE id = ?',
              )
              .get(targetId)
            broadcast({ type: MESSAGE_TYPES.USER_APPROVED, userId: targetId, user: approvedUser })
          }
          return
        }

        // Route to module
        const context = { broadcast, broadcastToGroup, clients, clientInfo, ws, db }
        try {
          await moduleRegistry.handle(msg as { type: string; payload?: unknown }, context)
        } catch (err) {
          const error = err as Error
          log.error('Module error', error.message)
          ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: error.message }))
        }
      }
    })

    ws.on('close', () => {
      if (clientInfo) {
        broadcast({ type: MESSAGE_TYPES.USER_OFFLINE, userId: clientInfo.id }, ws)
        clients.delete(ws)
        log.info(`Client disconnected: ${clientInfo.displayName}`)
      }
    })

    ws.on('error', (err) => log.error('WS error', err.message))
  })

  return httpServer
}

function broadcast(message: unknown, excludeWs: WebSocket | null = null) {
  const data = JSON.stringify(message)
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      ws.send(data)
    }
  }
}

function broadcastToAdmins(message: unknown, excludeWs: WebSocket | null = null) {
  const data = JSON.stringify(message)
  for (const [ws, info] of clients) {
    if (ws !== excludeWs && ws.readyState === 1 && info.role === 'admin') {
      ws.send(data)
    }
  }
}

function broadcastToGroup(message: unknown, groupId: string, excludeWs: WebSocket | null = null) {
  const now = Date.now()
  let cached = groupMemberCache.get(groupId)

  if (!cached || cached.expiresAt < now) {
    const db = getDb()
    const members = db
      .prepare('SELECT user_id FROM group_members WHERE group_id = ?')
      .all(groupId) as { user_id: string }[]
    cached = { memberIds: new Set(members.map((m) => m.user_id)), expiresAt: now + GROUP_CACHE_TTL }
    groupMemberCache.set(groupId, cached)
  }

  const data = JSON.stringify(message)
  for (const [ws, info] of clients) {
    if (ws !== excludeWs && ws.readyState === 1 && cached.memberIds.has(info.id)) {
      ws.send(data)
    }
  }
}

// Invalidate group member cache when membership changes
export function invalidateGroupCache(groupId: string) {
  groupMemberCache.delete(groupId)
}

function sendInitialState(ws: WebSocket, user: ClientInfo) {
  const db = getDb()

  const tasks = db
    .prepare(
      `
    SELECT * FROM tasks
    WHERE created_by = ? OR assigned_to = ? OR group_id IN (
      SELECT group_id FROM group_members WHERE user_id = ?
    )
    ORDER BY sort_order ASC, created_at DESC
  `,
    )
    .all(user.id, user.id, user.id)

  const groups = db
    .prepare(
      `
    SELECT g.*, gm.role as member_role FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `,
    )
    .all(user.id)

  const users = db
    .prepare(
      'SELECT id, display_name, role, avatar_color, status, enc_public_key FROM users WHERE status = ?',
    )
    .all('active')

  const pendingUsers =
    user.role === 'admin'
      ? db
          .prepare("SELECT id, display_name, avatar_color FROM users WHERE status = 'pending'")
          .all()
      : []
  const onlineUsers = [...clients.values()].map((c) => c.id)

  const ideas = db
    .prepare(
      `
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
  `,
    )
    .all(user.id)

  const pendingInvites = db
    .prepare(
      `
    SELECT gi.id, gi.group_id, gi.from_user_id, gi.type, gi.created_at,
           g.name as group_name, g.color as group_color,
           u.display_name as from_name
    FROM group_invites gi
    JOIN groups g ON g.id = gi.group_id
    JOIN users u ON u.id = gi.from_user_id
    WHERE gi.to_user_id = ? AND gi.status = 'pending'
  `,
    )
    .all(user.id)

  const pendingJoinRequests = db
    .prepare(
      `
    SELECT gi.id, gi.group_id, gi.to_user_id, gi.created_at,
           g.name as group_name, u.display_name as requester_name, u.avatar_color as requester_color
    FROM group_invites gi
    JOIN groups g ON g.id = gi.group_id
    JOIN users u ON u.id = gi.to_user_id
    WHERE gi.type = 'join_request' AND gi.status = 'pending'
      AND gi.group_id IN (SELECT group_id FROM group_members WHERE user_id = ? AND role = 'admin')
  `,
    )
    .all(user.id)

  ws.send(
    JSON.stringify({
      type: MESSAGE_TYPES.SYNC_RESPONSE,
      data: {
        tasks,
        groups,
        users,
        onlineUsers,
        ideas,
        pendingUsers,
        pendingInvites,
        pendingJoinRequests,
      },
    }),
  )
}

// Graceful shutdown
function shutdown() {
  try {
    getDb()?.pragma('wal_checkpoint(TRUNCATE)')
  } catch {
    /* ignore */
  }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export { broadcast, broadcastToGroup, clients, invalidateGroupCache }
