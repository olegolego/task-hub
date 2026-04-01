import * as crypto from 'crypto'

const SERVER_SECRET = crypto.randomBytes(32)
const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface TokenPayload {
  userId: string
  action: 'upload' | 'download'
  fileId?: string
  timestamp: number
}

export function generateToken(
  userId: string,
  action: 'upload' | 'download',
  fileId?: string,
): string {
  const payload: TokenPayload = { userId, action, fileId, timestamp: Date.now() }
  const data = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', SERVER_SECRET).update(data).digest('base64')
  return Buffer.from(JSON.stringify({ ...payload, hmac })).toString('base64url')
}

export function verifyToken(
  token: string,
  action: 'upload' | 'download',
  fileId?: string,
): { valid: boolean; userId?: string } {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { hmac, ...payload } = decoded as TokenPayload & { hmac: string }

    // Verify HMAC
    const expectedHmac = crypto
      .createHmac('sha256', SERVER_SECRET)
      .update(JSON.stringify(payload))
      .digest('base64')
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return { valid: false }
    }

    // Verify TTL
    if (Date.now() - payload.timestamp > TOKEN_TTL_MS) {
      return { valid: false }
    }

    // Verify action matches
    if (payload.action !== action) {
      return { valid: false }
    }

    // For downloads, verify fileId matches
    if (action === 'download' && fileId && payload.fileId !== fileId) {
      return { valid: false }
    }

    return { valid: true, userId: payload.userId }
  } catch {
    return { valid: false }
  }
}
