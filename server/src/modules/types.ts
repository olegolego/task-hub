import type Database from 'better-sqlite3'
import type WebSocket from 'ws'
import type { ClientInfo } from '../auth/permissions.js'

export interface ModuleContext {
  broadcast: (message: unknown, excludeWs?: WebSocket | null) => void
  broadcastToGroup: (message: unknown, groupId: string, excludeWs?: WebSocket | null) => void
  clients: Map<WebSocket, ClientInfo>
  clientInfo: ClientInfo
  ws: WebSocket
  db: Database.Database
}

export interface ServerModule {
  name: string
  messageTypes: string[]
  init(db: Database.Database): void
  handle(message: { type: string; payload?: unknown }, context: ModuleContext): Promise<void>
}
