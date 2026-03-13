const path = require('path')
const { app } = require('electron')

let db

function getDb() {
  if (db) return db

  const Database = require('better-sqlite3')
  const dbPath = path.join(app.getPath('userData'), 'tasks.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title       TEXT NOT NULL,
      completed   INTEGER DEFAULT 0,
      priority    TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      category    TEXT DEFAULT 'general',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now')),
      sort_order  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return db
}

// Tasks
function getAllTasks() {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM tasks
    ORDER BY
      completed ASC,
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 END,
      created_at ASC
  `).all()
}

function createTask({ title, priority = 'medium', category = 'general' }) {
  const db = getDb()
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM tasks').get().m
  const stmt = db.prepare(`
    INSERT INTO tasks (title, priority, category, sort_order)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `)
  return stmt.get(title, priority, category, maxOrder + 1)
}

function updateTask({ id, ...fields }) {
  const db = getDb()
  const allowed = ['title', 'completed', 'priority', 'category', 'sort_order']
  const updates = Object.keys(fields).filter(k => allowed.includes(k))
  if (updates.length === 0) return getTaskById(id)

  const setClause = [...updates.map(k => `${k} = ?`), 'updated_at = datetime(\'now\')'].join(', ')
  const values = updates.map(k => fields[k])
  db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`).run(...values, id)
  return getTaskById(id)
}

function deleteTask({ id }) {
  const db = getDb()
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

function reorderTask({ id, newSortOrder }) {
  const db = getDb()
  db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?').run(newSortOrder, id)
}

function getTaskById(id) {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id)
}

// Settings
function getSetting(key, defaultValue = null) {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return defaultValue
  try { return JSON.parse(row.value) } catch { return row.value }
}

function setSetting(key, value) {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

function getAllSettings() {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map(r => {
    try { return [r.key, JSON.parse(r.value)] } catch { return [r.key, r.value] }
  }))
}

module.exports = { getAllTasks, createTask, updateTask, deleteTask, reorderTask, getSetting, setSetting, getAllSettings }
