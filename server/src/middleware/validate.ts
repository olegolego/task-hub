import type { ZodSchema, ZodError } from 'zod'
import type WebSocket from 'ws'
import { MESSAGE_TYPES } from '@task-hub/shared'

export function validatePayload<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  ws: WebSocket,
): T | null {
  const result = schema.safeParse(payload)
  if (!result.success) {
    const errors = (result.error as ZodError).issues.map((i) => i.message).join(', ')
    ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: `Validation failed: ${errors}` }))
    return null
  }
  return result.data
}
