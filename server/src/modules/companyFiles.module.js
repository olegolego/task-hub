const { MESSAGE_TYPES } = require('@task-hub/shared')

let db

function init(database) {
  db = database
}

async function handle(msg, { clientInfo, ws, broadcast, clients }) {
  // List all company files (optionally filtered by folder)
  if (msg.type === 'files:list') {
    const files = db.prepare(`
      SELECT cf.id, cf.name, cf.size, cf.mime_type as mimeType, cf.folder,
             cf.uploaded_by as uploadedBy, cf.created_at as createdAt,
             u.display_name as uploaderName, u.avatar_color as uploaderColor
      FROM company_files cf
      JOIN users u ON u.id = cf.uploaded_by
      ORDER BY cf.created_at DESC
    `).all()
    const folders = db.prepare('SELECT name FROM company_folders ORDER BY created_at ASC').all().map(r => r.name)
    ws.send(JSON.stringify({ type: 'files:list_response', files, folders }))
    return
  }

  // Create a named folder
  if (msg.type === 'files:create_folder') {
    const { name } = msg.payload || {}
    if (!name || !name.trim()) return
    const folderName = name.trim()
    try {
      db.prepare('INSERT OR IGNORE INTO company_folders (name, created_by) VALUES (?, ?)').run(folderName, clientInfo.id)
    } catch {}
    const outMsg = JSON.stringify({ type: 'files:folder_created', name: folderName })
    for (const [ws2] of clients) {
      if (ws2.readyState === 1) ws2.send(outMsg)
    }
    return
  }

  // Delete a company file (any active user can delete their own; admin can delete any)
  if (msg.type === 'files:delete') {
    const { fileId } = msg.payload || {}
    if (!fileId) return
    const file = db.prepare('SELECT * FROM company_files WHERE id = ?').get(fileId)
    if (!file) return
    if (file.uploaded_by !== clientInfo.id && clientInfo.role !== 'admin') {
      ws.send(JSON.stringify({ type: MESSAGE_TYPES.ERROR, error: 'Permission denied' }))
      return
    }
    try {
      const fs = require('fs')
      if (fs.existsSync(file.stored_path)) fs.unlinkSync(file.stored_path)
    } catch {}
    db.prepare('DELETE FROM company_files WHERE id = ?').run(fileId)
    broadcast({ type: 'files:deleted', fileId })
  }
}

module.exports = {
  name: 'companyFiles',
  messageTypes: ['files:list', 'files:delete', 'files:create_folder'],
  init,
  handle,
}
