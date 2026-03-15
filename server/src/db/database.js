const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const fs = require('fs')

const DATA_DIR = path.join(os.homedir(), '.taskmanager-server')
const DB_PATH = path.join(DATA_DIR, 'taskmanager.db')

let db

function getDataDir() { return DATA_DIR }

function initDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run migrations
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

  // Migration: add enc_public_key column to users if it doesn't exist yet
  const hasEncKey = db.prepare("SELECT COUNT(*) as c FROM pragma_table_info('users') WHERE name='enc_public_key'").get().c
  if (!hasEncKey) {
    db.exec('ALTER TABLE users ADD COLUMN enc_public_key TEXT')
    console.log('[DB] Migration: added enc_public_key to users')
  }

  // Migration: add deleted_at to direct_messages
  const dmColsAll = db.prepare("SELECT name FROM pragma_table_info('direct_messages')").all().map(r => r.name)
  if (!dmColsAll.includes('deleted_at')) {
    db.exec('ALTER TABLE direct_messages ADD COLUMN deleted_at TEXT')
    console.log('[DB] Migration: added deleted_at to direct_messages')
  }

  // Migration: add edited_at to direct_messages
  const dmColsEdit = db.prepare("SELECT name FROM pragma_table_info('direct_messages')").all().map(r => r.name)
  if (!dmColsEdit.includes('edited_at')) {
    db.exec('ALTER TABLE direct_messages ADD COLUMN edited_at TEXT')
    console.log('[DB] Migration: added edited_at to direct_messages')
  }

  // Migration: add file columns to direct_messages
  const dmCols = db.prepare("SELECT name FROM pragma_table_info('direct_messages')").all().map(r => r.name)
  if (!dmCols.includes('file_id')) {
    db.exec(`
      ALTER TABLE direct_messages ADD COLUMN file_id TEXT;
      ALTER TABLE direct_messages ADD COLUMN file_name TEXT;
      ALTER TABLE direct_messages ADD COLUMN file_size INTEGER;
      ALTER TABLE direct_messages ADD COLUMN mime_type TEXT;
      ALTER TABLE direct_messages ADD COLUMN enc_file_key TEXT;
      ALTER TABLE direct_messages ADD COLUMN file_key_nonce TEXT;
    `)
    console.log('[DB] Migration: added file columns to direct_messages')
  }

  // Ensure at least one admin exists — promote the oldest active user if needed
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count
  if (adminCount === 0) {
    const oldest = db.prepare("SELECT id FROM users WHERE status = 'active' ORDER BY created_at ASC LIMIT 1").get()
    if (oldest) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(oldest.id)
      console.log('[DB] Auto-promoted oldest user to admin:', oldest.id)
    }
  }

  console.log('[DB] Initialized at', DB_PATH)
  return db
}

module.exports = { get db() { return db }, initDb, getDataDir }
