import type { ServerModule, ModuleContext } from './types.js'

const presenceModule: ServerModule = {
  name: 'presence',
  messageTypes: ['user:status', 'user:list'],

  init(_db) {},

  async handle(message, ctx: ModuleContext) {
    const { broadcast, clients, clientInfo, ws, db } = ctx

    if (message.type === 'user:status') {
      const p = message.payload as { status?: string } | undefined
      broadcast({ type: 'user:status', userId: clientInfo.id, status: p?.status }, ws)
    }

    if (message.type === 'user:list') {
      const onlineIds = new Set([...clients.values()].map((c) => c.id))
      const users = db
        .prepare(
          `
        SELECT id, display_name, email, role, avatar_color, last_seen_at
        FROM users WHERE status = 'active'
        ORDER BY display_name ASC
      `,
        )
        .all() as Record<string, unknown>[]

      const result = users.map((u) => ({ ...u, online: onlineIds.has(u.id as string) }))
      ws.send(JSON.stringify({ type: 'user:list_response', users: result }))
    }
  },
}

export default presenceModule
