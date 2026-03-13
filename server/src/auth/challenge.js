const nacl = require('tweetnacl')
const { decodeBase64, encodeBase64 } = require('tweetnacl-util')
const database = require('../db/database')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

// Derive a fingerprint (user ID) from a public key
function fingerprintOf(publicKeyBase64) {
  const hash = crypto.createHash('sha256').update(publicKeyBase64).digest('hex')
  return hash.slice(0, 16) // short fingerprint
}

// Handle auth:response message
function handleAuth(msg, expectedChallenge) {
  const { publicKey: publicKeyB64, signature: signatureB64, displayName, challenge } = msg

  if (challenge !== expectedChallenge) {
    return { success: false, error: 'Challenge mismatch' }
  }

  try {
    const publicKey = decodeBase64(publicKeyB64)
    const signature = decodeBase64(signatureB64)
    const messageBytes = new TextEncoder().encode(challenge)

    const valid = nacl.sign.detached.verify(messageBytes, signature, publicKey)
    if (!valid) {
      return { success: false, error: 'Invalid signature' }
    }

    const userId = fingerprintOf(publicKeyB64)

    // Register or fetch user
    let user = database.db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    if (!user) {
      // Auto-register new user
      const colors = ['#4361ee', '#f72585', '#4cc9f0', '#06d6a0', '#ffd166', '#ef476f', '#7209b7', '#3a86a7']
      const avatarColor = colors[Math.floor(Math.random() * colors.length)]
      const name = displayName || `User-${userId.slice(0, 6)}`

      // First user ever becomes admin and is immediately active
      const userCount = database.db.prepare("SELECT COUNT(*) as count FROM users").get().count
      const isFirstUser = userCount === 0
      const role = isFirstUser ? 'admin' : 'member'
      const status = isFirstUser ? 'active' : 'pending'

      database.db.prepare(`
        INSERT INTO users (id, public_key, display_name, avatar_color, role, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, publicKeyB64, name, avatarColor, role, status)

      user = database.db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
      console.log('[Auth] New user registered:', name, userId, `(${role}, ${status})`)
    } else {
      // Update last seen
      database.db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(userId)
    }

    return {
      success: true,
      user: {
        id: user.id,
        displayName: user.display_name,
        role: user.role,
        status: user.status,
        avatarColor: user.avatar_color,
        publicKey: publicKeyB64,
      },
    }
  } catch (err) {
    console.error('[Auth] Error:', err)
    return { success: false, error: 'Auth failed: ' + err.message }
  }
}

// Verify a message signature
function verifyMessage(msg, publicKeyB64) {
  // In dev mode or when SKIP_SIG_VERIFY is set, skip signature verification for non-auth messages
  if (process.env.NODE_ENV === 'development' || process.env.SKIP_SIG_VERIFY) {
    return true
  }

  if (!msg.signature) return false

  try {
    const publicKey = decodeBase64(publicKeyB64)
    const signature = decodeBase64(msg.signature)
    const body = JSON.stringify({ id: msg.id, type: msg.type, payload: msg.payload, timestamp: msg.timestamp })
    const messageBytes = new TextEncoder().encode(body)
    return nacl.sign.detached.verify(messageBytes, signature, publicKey)
  } catch {
    return false
  }
}

module.exports = { handleAuth, verifyMessage, fingerprintOf }
