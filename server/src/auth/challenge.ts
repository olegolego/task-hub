import nacl from 'tweetnacl'
import { decodeBase64 } from 'tweetnacl-util'
import * as crypto from 'crypto'
import { createLogger } from '../utils/logger.js'
import type Database from 'better-sqlite3'

const log = createLogger('auth')

export function fingerprintOf(publicKeyBase64: string): string {
  const hash = crypto.createHash('sha256').update(publicKeyBase64).digest('hex')
  return hash.slice(0, 16)
}

interface AuthResult {
  success: boolean
  error?: string
  user?: {
    id: string
    displayName: string
    role: string
    status: string
    avatarColor: string
    publicKey: string
    encPublicKey: string | null
  }
}

export function handleAuth(
  msg: {
    publicKey?: string
    encPublicKey?: string
    signature?: string
    displayName?: string
    challenge?: string
  },
  expectedChallenge: string,
  db: Database.Database,
): AuthResult {
  const {
    publicKey: publicKeyB64,
    encPublicKey: encPublicKeyB64,
    signature: signatureB64,
    displayName,
    challenge,
  } = msg

  if (challenge !== expectedChallenge) {
    return { success: false, error: 'Challenge mismatch' }
  }

  try {
    const publicKey = decodeBase64(publicKeyB64!)
    const signature = decodeBase64(signatureB64!)
    const messageBytes = new TextEncoder().encode(challenge)

    const valid = nacl.sign.detached.verify(messageBytes, signature, publicKey)
    if (!valid) {
      return { success: false, error: 'Invalid signature' }
    }

    const userId = fingerprintOf(publicKeyB64!)

    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | Record<string, unknown>
      | undefined
    if (!user) {
      const colors = [
        '#4361ee',
        '#f72585',
        '#4cc9f0',
        '#06d6a0',
        '#ffd166',
        '#ef476f',
        '#7209b7',
        '#3a86a7',
      ]
      const avatarColor = colors[Math.floor(Math.random() * colors.length)]
      const name = displayName || `User-${userId.slice(0, 6)}`

      const userCount = (
        db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
      ).count
      const isFirstUser = userCount === 0
      const role = isFirstUser ? 'admin' : 'member'
      const status = isFirstUser ? 'active' : 'pending'

      db.prepare(
        `
        INSERT INTO users (id, public_key, enc_public_key, display_name, avatar_color, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(userId, publicKeyB64, encPublicKeyB64 || null, name, avatarColor, role, status)

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>
      log.info(`New user registered: ${name} ${userId} (${role}, ${status})`)
    } else {
      db.prepare(
        "UPDATE users SET last_seen_at = datetime('now'), enc_public_key = COALESCE(?, enc_public_key) WHERE id = ?",
      ).run(encPublicKeyB64 || null, userId)
    }

    return {
      success: true,
      user: {
        id: user.id as string,
        displayName: user.display_name as string,
        role: user.role as string,
        status: user.status as string,
        avatarColor: user.avatar_color as string,
        publicKey: publicKeyB64!,
        encPublicKey: (encPublicKeyB64 || (user.enc_public_key as string | null)) ?? null,
      },
    }
  } catch (err) {
    const error = err as Error
    log.error('Auth error', error.message)
    return { success: false, error: 'Auth failed: ' + error.message }
  }
}

export function verifyMessage(
  msg: { signature?: string; id?: string; type?: string; payload?: unknown; timestamp?: string },
  publicKeyB64: string,
): boolean {
  if (!msg.signature) return false

  try {
    const publicKey = decodeBase64(publicKeyB64)
    const signature = decodeBase64(msg.signature)
    const body = JSON.stringify({
      id: msg.id,
      type: msg.type,
      payload: msg.payload,
      timestamp: msg.timestamp,
    })
    const messageBytes = new TextEncoder().encode(body)
    return nacl.sign.detached.verify(messageBytes, signature, publicKey)
  } catch {
    return false
  }
}
