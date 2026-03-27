import * as fs from 'fs'
import { MESSAGE_TYPES } from '@task-hub/shared'
import { createLogger } from '../utils/logger.js'
import type Database from 'better-sqlite3'
import type { ServerModule, ModuleContext } from './types.js'

const log = createLogger('companyFiles')

let db: Database.Database

const companyFilesModule: ServerModule = {
  name: 'companyFiles',
  messageTypes: [
    'files:list',
    'files:delete',
    'files:rename',
    'files:create_folder',
    'files:delete_folder',
  ],

  init(database) {
    db = database
  },

  async handle(msg, ctx: ModuleContext) {
    const { clientInfo, ws, broadcast, clients } = ctx

    if (msg.type === 'files:list') {
      const files = db
        .prepare(
          `
        SELECT cf.id, cf.name, cf.size, cf.mime_type as mimeType, cf.folder,
               cf.uploaded_by as uploadedBy, cf.created_at as createdAt,
               u.display_name as uploaderName, u.avatar_color as uploaderColor
        FROM company_files cf
        JOIN users u ON u.id = cf.uploaded_by
        ORDER BY cf.created_at DESC
      `,
        )
        .all()
      const folders = (
        db.prepare('SELECT name FROM company_folders ORDER BY created_at ASC').all() as {
          name: string
        }[]
      ).map((r) => r.name)
      ws.send(JSON.stringify({ type: 'files:list_response', files, folders }))
      return
    }

    if (msg.type === 'files:create_folder') {
      const p = msg.payload as { name?: string } | undefined
      const name = p?.name?.trim()
      if (!name) return
      try {
        db.prepare('INSERT OR IGNORE INTO company_folders (name, created_by) VALUES (?, ?)').run(
          name,
          clientInfo.id,
        )
      } catch {
        /* ignore duplicate */
      }
      const outMsg = JSON.stringify({ type: 'files:folder_created', name })
      for (const [ws2] of clients) {
        if (ws2.readyState === 1) ws2.send(outMsg)
      }
      return
    }

    if (msg.type === 'files:delete_folder') {
      const p = msg.payload as { name?: string } | undefined
      const name = p?.name
      if (!name) return
      if (clientInfo.role !== 'admin') {
        ws.send(
          JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Only admins can delete folders' }),
        )
        return
      }
      db.prepare("UPDATE company_files SET folder = 'General' WHERE folder = ?").run(name)
      db.prepare('DELETE FROM company_folders WHERE name = ?').run(name)
      const outMsg = JSON.stringify({ type: 'files:folder_deleted', name })
      for (const [ws2] of clients) {
        if (ws2.readyState === 1) ws2.send(outMsg)
      }
      log.info('Folder deleted', { name })
      return
    }

    if (msg.type === 'files:rename') {
      const p = msg.payload as { fileId?: string; name?: string } | undefined
      if (!p?.fileId || !p?.name?.trim()) return
      const file = db.prepare('SELECT * FROM company_files WHERE id = ?').get(p.fileId) as
        | { uploaded_by: string }
        | undefined
      if (!file) return
      if (file.uploaded_by !== clientInfo.id && clientInfo.role !== 'admin') {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Permission denied' }))
        return
      }
      db.prepare('UPDATE company_files SET name = ? WHERE id = ?').run(p.name.trim(), p.fileId)
      broadcast({ type: 'files:renamed', fileId: p.fileId, name: p.name.trim() })
      return
    }

    if (msg.type === 'files:delete') {
      const p = msg.payload as { fileId?: string } | undefined
      if (!p?.fileId) return
      const file = db.prepare('SELECT * FROM company_files WHERE id = ?').get(p.fileId) as
        | { uploaded_by: string; stored_path: string }
        | undefined
      if (!file) return
      if (file.uploaded_by !== clientInfo.id && clientInfo.role !== 'admin') {
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Permission denied' }))
        return
      }
      try {
        if (fs.existsSync(file.stored_path)) fs.unlinkSync(file.stored_path)
      } catch {
        /* ignore */
      }
      db.prepare('DELETE FROM company_files WHERE id = ?').run(p.fileId)
      broadcast({ type: 'files:deleted', fileId: p.fileId })
      log.info('File deleted', { fileId: p.fileId })
    }
  },
}

export default companyFilesModule
