import Database from 'better-sqlite3'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { createLogger } from '../utils/logger.js'

const log = createLogger('db')

const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), '.taskmanager-server')
const DB_PATH = path.join(DATA_DIR, 'taskmanager.db')

let db: Database.Database

export function getDataDir(): string {
  return DATA_DIR
}

export function initDb(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Core schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      public_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
      status TEXT DEFAULT 'active' CHECK(status IN ('pending','active','disabled')),
      avatar_color TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT REFERENCES users(id),
      color TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin','member')),
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      status TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
      created_by TEXT REFERENCES users(id),
      assigned_to TEXT REFERENCES users(id),
      group_id TEXT REFERENCES groups(id),
      due_date TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT,
      created_by TEXT REFERENCES users(id),
      group_id TEXT REFERENCES groups(id),
      category TEXT DEFAULT 'general',
      status TEXT DEFAULT 'open' CHECK(status IN ('open','discussed','accepted','archived')),
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS idea_votes (
      idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      vote INTEGER DEFAULT 1 CHECK(vote IN (-1, 1)),
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (idea_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS idea_comments (
      id TEXT PRIMARY KEY,
      idea_id TEXT REFERENCES ideas(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ideas_group ON ideas(group_id);

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      message_type TEXT NOT NULL,
      actor_id TEXT REFERENCES users(id),
      target_type TEXT,
      target_id TEXT,
      summary TEXT,
      group_id TEXT REFERENCES groups(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(created_at);

    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY,
      from_user TEXT NOT NULL REFERENCES users(id),
      to_user TEXT NOT NULL REFERENCES users(id),
      encrypted TEXT NOT NULL,
      nonce TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(from_user, to_user);
    CREATE INDEX IF NOT EXISTS idx_dm_time ON direct_messages(created_at);

    CREATE TABLE IF NOT EXISTS group_invites (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      to_user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('invite', 'join_request')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      stored_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dm_reactions (
      dm_id TEXT NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      emoji TEXT NOT NULL,
      PRIMARY KEY (dm_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS company_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      folder TEXT DEFAULT 'General',
      stored_path TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_folders (
      name TEXT PRIMARY KEY,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_group_messages ON group_messages(group_id, created_at);

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      group_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS meeting_attendees (
      meeting_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      PRIMARY KEY (meeting_id, user_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
  `)

  // Migrations
  const addColumnIfMissing = (table: string, column: string, type: string) => {
    const cols = db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as {
      name: string
    }[]
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
      log.info(`Migration: added ${column} to ${table}`)
    }
  }

  addColumnIfMissing('users', 'enc_public_key', 'TEXT')
  addColumnIfMissing('direct_messages', 'deleted_at', 'TEXT')
  addColumnIfMissing('direct_messages', 'edited_at', 'TEXT')
  addColumnIfMissing('direct_messages', 'file_id', 'TEXT')
  addColumnIfMissing('direct_messages', 'file_name', 'TEXT')
  addColumnIfMissing('direct_messages', 'file_size', 'INTEGER')
  addColumnIfMissing('direct_messages', 'mime_type', 'TEXT')
  addColumnIfMissing('direct_messages', 'enc_file_key', 'TEXT')
  addColumnIfMissing('direct_messages', 'file_key_nonce', 'TEXT')

  // Ensure at least one admin
  const adminCount = (
    db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as {
      count: number
    }
  ).count
  if (adminCount === 0) {
    const oldest = db
      .prepare("SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string } | undefined
    if (oldest) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(oldest.id)
      log.info(`Auto-promoted oldest user to admin: ${oldest.id}`)
    }
  }

  log.info(`Initialized at ${DB_PATH}`)
  return db
}

export function getDb(): Database.Database {
  return db
}

// CommonJS compatibility — keep the getter pattern
const database: {
  readonly db: Database.Database
  initDb: typeof initDb
  getDataDir: typeof getDataDir
} = {
  get db() {
    return db
  },
  initDb,
  getDataDir,
}
export default database
