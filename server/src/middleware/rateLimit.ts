interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const DEFAULT_WINDOW_MS = 60_000 // 1 minute
const DEFAULT_MAX_REQUESTS = 60 // 60 requests per minute

export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
}

export function checkRateLimit(
  userId: string,
  messageType: string,
  options: RateLimitOptions = {},
): boolean {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS
  const key = `${userId}:${messageType}`
  const now = Date.now()

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    return false // Rate limited
  }

  entry.timestamps.push(now)
  return true
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < DEFAULT_WINDOW_MS)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}, 5 * 60_000) // Clean up every 5 minutes
