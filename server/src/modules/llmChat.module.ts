import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from '../utils/logger.js'
import type Database from 'better-sqlite3'
import type { ServerModule, ModuleContext } from './types.js'

const log = createLogger('llmChat')

const LLM_SERVER_URL = process.env.LLM_SERVER_URL || 'http://localhost:8766'
const MAX_HISTORY = 20

const CONTEXT_KEYWORDS: Record<string, RegExp> = {
  tasks: /\b(task|tasks|todo|to-do|assigned|overdue|priority|backlog|sprint|work item)\b/i,
  ideas: /\b(idea|ideas|suggestion|suggestions|proposal|proposals|pitch)\b/i,
  files: /\b(file|files|document|documents|doc|docs|attachment|upload|spreadsheet|report)\b/i,
  messages: /\b(message|messages|chat|chats|conversation|said|wrote|group|channel)\b/i,
  meetings: /\b(meeting|meetings|calendar|schedule|event|standup|sync|call)\b/i,
  users: /\b(user|users|team|member|members|people|person|who|colleague|everyone)\b/i,
}

const MENTION_ALIASES: Record<string, string[]> = {
  tasks: ['tasks', 'task'],
  ideas: ['ideas', 'idea'],
  files: ['files', 'file', 'docs', 'documents'],
  messages: ['messages', 'message', 'chat'],
  meetings: ['meetings', 'meeting', 'calendar', 'schedule'],
  users: ['users', 'user', 'team', 'people'],
}

const AVAILABLE_CONTEXTS = Object.keys(CONTEXT_KEYWORDS)

function detectContext(text: string): Set<string> {
  const detected = new Set<string>()
  for (const [key, re] of Object.entries(CONTEXT_KEYWORDS)) {
    if (re.test(text)) detected.add(key)
  }
  const mentions = text.match(/@([\w.:_-]+)/g) || []
  for (const mention of mentions) {
    const word = mention.slice(1).toLowerCase()
    for (const [key, aliases] of Object.entries(MENTION_ALIASES) as [string, string[]][]) {
      if (aliases.includes(word)) detected.add(key)
    }
  }
  return detected
}

function extractFileMentions(text: string): string[] {
  const ids: string[] = []
  const re = /@file:([\w-]+)/g
  let m
  while ((m = re.exec(text)) !== null) ids.push(m[1]!)
  return ids
}

function ctxUsers(db: Database.Database): string {
  const users = db
    .prepare(
      "SELECT display_name, email, role, status, last_seen_at FROM users WHERE status = 'active' ORDER BY display_name",
    )
    .all() as Record<string, unknown>[]
  if (!users.length) return ''
  const lines = users.map(
    (u) =>
      `- ${u.display_name} (${u.role})` +
      (u.email ? ` <${u.email}>` : '') +
      (u.last_seen_at ? ` — last seen ${u.last_seen_at}` : ''),
  )
  return `## Team Members\n${lines.join('\n')}`
}

function ctxTasks(db: Database.Database, userId: string): string {
  const tasks = db
    .prepare(
      `
    SELECT t.title, t.description, t.priority, t.status, t.due_date,
           c.display_name as creator, a.display_name as assignee, g.name as group_name
    FROM tasks t LEFT JOIN users c ON t.created_by = c.id LEFT JOIN users a ON t.assigned_to = a.id LEFT JOIN groups g ON t.group_id = g.id
    WHERE (t.created_by = ? OR t.assigned_to = ? OR t.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?))
    ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, t.created_at DESC
    LIMIT 80
  `,
    )
    .all(userId, userId, userId) as Record<string, unknown>[]
  if (!tasks.length) return ''
  const lines = tasks.map(
    (t) =>
      `- [${t.status}][${t.priority}] ${t.title}` +
      (t.assignee ? ` → ${t.assignee}` : '') +
      (t.group_name ? ` (${t.group_name})` : '') +
      (t.due_date ? ` due ${t.due_date}` : '') +
      (t.description ? `\n    ${(t.description as string).slice(0, 120)}` : ''),
  )
  return `## Tasks\n${lines.join('\n')}`
}

function ctxIdeas(db: Database.Database, userId: string): string {
  const ideas = db
    .prepare(
      `
    SELECT i.title, i.body, i.status, i.category, u.display_name as author,
           (SELECT COUNT(*) FROM idea_votes WHERE idea_id = i.id AND vote = 1) as upvotes
    FROM ideas i JOIN users u ON i.created_by = u.id
    WHERE i.status != 'archived' AND (i.group_id IS NULL OR i.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?))
    ORDER BY upvotes DESC, i.created_at DESC LIMIT 40
  `,
    )
    .all(userId) as Record<string, unknown>[]
  if (!ideas.length) return ''
  const lines = ideas.map(
    (i) =>
      `- [${i.status}] "${i.title}" by ${i.author} (${i.upvotes} upvotes, ${i.category})` +
      (i.body ? `\n    ${(i.body as string).slice(0, 150)}` : ''),
  )
  return `## Ideas\n${lines.join('\n')}`
}

function ctxMeetings(db: Database.Database, userId: string): string {
  const now = Date.now()
  const meetings = db
    .prepare(
      `
    SELECT m.title, m.description, m.start_time, m.end_time, u.display_name as organizer, ma.status as my_status,
           (SELECT GROUP_CONCAT(u2.display_name, ', ') FROM meeting_attendees ma2 JOIN users u2 ON ma2.user_id = u2.id WHERE ma2.meeting_id = m.id AND ma2.status = 'accepted') as attendees
    FROM meetings m JOIN users u ON m.created_by = u.id LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id AND ma.user_id = ?
    WHERE m.end_time > ? ORDER BY m.start_time ASC LIMIT 20
  `,
    )
    .all(userId, now) as Record<string, unknown>[]
  if (!meetings.length) return ''
  const lines = meetings.map((m) => {
    const start = new Date(m.start_time as number).toLocaleString()
    return (
      `- "${m.title}" by ${m.organizer} at ${start} [${m.my_status}]` +
      (m.attendees ? `\n    Attendees: ${m.attendees}` : '') +
      (m.description ? `\n    ${(m.description as string).slice(0, 100)}` : '')
    )
  })
  return `## Upcoming Meetings\n${lines.join('\n')}`
}

function ctxMessages(db: Database.Database, userId: string): string {
  const messages = db
    .prepare(
      `
    SELECT gm.body, u.display_name, g.name as group_name, gm.created_at
    FROM group_messages gm JOIN users u ON gm.from_user_id = u.id JOIN groups g ON gm.group_id = g.id
    WHERE gm.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
    ORDER BY gm.created_at DESC LIMIT 60
  `,
    )
    .all(userId) as Record<string, unknown>[]
  if (!messages.length) return ''
  const lines = messages.reverse().map((m) => `[${m.group_name}] ${m.display_name}: ${m.body}`)
  return `## Recent Group Messages\n${lines.join('\n')}`
}

function ctxFiles(db: Database.Database, dataDir: string, fileIds: string[] = []): string {
  let rows: Record<string, unknown>[]
  if (fileIds.length > 0) {
    const placeholders = fileIds.map(() => '?').join(',')
    rows = db
      .prepare(
        `SELECT cf.id, cf.name, cf.mime_type, cf.folder, cf.stored_path, u.display_name as uploader FROM company_files cf JOIN users u ON cf.uploaded_by = u.id WHERE cf.id IN (${placeholders}) ORDER BY cf.created_at DESC`,
      )
      .all(...fileIds) as Record<string, unknown>[]
  } else {
    rows = db
      .prepare(
        'SELECT cf.id, cf.name, cf.mime_type, cf.folder, cf.stored_path, u.display_name as uploader FROM company_files cf JOIN users u ON cf.uploaded_by = u.id ORDER BY cf.created_at DESC LIMIT 30',
      )
      .all() as Record<string, unknown>[]
  }
  if (!rows.length) return ''
  const textTypes = ['text/', 'application/json', 'application/xml', 'application/javascript']
  const textExts = /\.(txt|md|js|ts|py|json|yaml|yml|csv|html|css|sh|sql|log)$/i
  const parts: string[] = []
  for (const f of rows) {
    const fullPath = path.join(dataDir, 'uploads', f.stored_path as string)
    const isPdf =
      ((f.mime_type as string) || '').includes('pdf') || /\.pdf$/i.test(f.name as string)
    const isText =
      textTypes.some((t) => ((f.mime_type as string) || '').startsWith(t)) ||
      textExts.test(f.name as string)
    if (isPdf) {
      try {
        const { execFileSync } = require('child_process')
        const text = execFileSync('pdftotext', [fullPath, '-'], {
          timeout: 10000,
          maxBuffer: 2 * 1024 * 1024,
        })
          .toString('utf8')
          .trim()
        parts.push(
          `### ${f.name} [${f.folder}] uploaded by ${f.uploader}\n\`\`\`\n${text.slice(0, 4000)}\n\`\`\``,
        )
      } catch {
        parts.push(`### ${f.name} [${f.folder}] (PDF — could not extract text)`)
      }
      continue
    }
    if (!isText) {
      parts.push(`### ${f.name} [${f.folder}] (binary, uploaded by ${f.uploader})`)
      continue
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf8').slice(0, 3000)
      parts.push(
        `### ${f.name} [${f.folder}] uploaded by ${f.uploader}\n\`\`\`\n${content}\n\`\`\``,
      )
    } catch {
      parts.push(`### ${f.name} (could not read)`)
    }
  }
  return `## Company Files\n${parts.join('\n\n')}`
}

function buildSystemPrompt(
  db: Database.Database,
  dataDir: string,
  userId: string,
  contextKeys: Set<string>,
  useCompanyData: boolean,
  specificFileIds: string[] = [],
): string {
  const sections: string[] = []
  if (
    contextKeys.has('users') ||
    contextKeys.has('tasks') ||
    contextKeys.has('ideas') ||
    contextKeys.has('meetings') ||
    contextKeys.has('messages')
  ) {
    sections.push(ctxUsers(db))
  }
  if (contextKeys.has('tasks')) sections.push(ctxTasks(db, userId))
  if (contextKeys.has('ideas')) sections.push(ctxIdeas(db, userId))
  if (contextKeys.has('meetings')) sections.push(ctxMeetings(db, userId))
  if (contextKeys.has('messages')) sections.push(ctxMessages(db, userId))
  if (specificFileIds.length > 0) {
    sections.push(ctxFiles(db, dataDir, specificFileIds))
  } else if (contextKeys.has('files') || useCompanyData) {
    sections.push(ctxFiles(db, dataDir))
  }
  const contextBlock = sections.filter(Boolean).join('\n\n')
  return [
    'You are an AI assistant embedded in TaskHub, a team collaboration platform.',
    'You help users understand their work, team activity, and company information.',
    "Be concise and helpful. If you don't know something, say so honestly.",
    contextBlock ? `\nHere is the current data from the system:\n\n${contextBlock}` : '',
    "\nAnswer the user's question using this information where relevant.",
  ]
    .filter(Boolean)
    .join('\n')
}

async function callLLM(
  messages: { role: string; content: string }[],
  maxTokens = 1024,
  temperature = 0.7,
) {
  const res = await fetch(`${LLM_SERVER_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) throw new Error(`LLM server error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<{
    text: string
    model: string
    prompt_tokens: number
    completion_tokens: number
  }>
}

const llmChatModule: ServerModule = {
  name: 'llmChat',
  messageTypes: [
    'llm:chat',
    'llm:chat_new',
    'llm:chat_list',
    'llm:chat_history',
    'llm:chat_delete',
    'llm:chat_rename',
    'llm:context_list',
    'llm:files_list',
    'llm:status',
  ],

  init(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS llm_chats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_llm_chats_user ON llm_chats(user_id, updated_at);
      CREATE TABLE IF NOT EXISTS llm_messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES llm_chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_llm_messages_chat ON llm_messages(chat_id, created_at);
    `)
  },

  async handle(message, ctx: ModuleContext) {
    const { type, payload } = message
    const { clientInfo, ws, db } = ctx

    if (type === 'llm:status') {
      try {
        const res = await fetch(`${LLM_SERVER_URL}/health`)
        const data = (await res.json()) as { status: string; model: string }
        ws.send(
          JSON.stringify({ type: 'llm:status_response', status: data.status, model: data.model }),
        )
      } catch {
        ws.send(JSON.stringify({ type: 'llm:status_response', status: 'offline', model: null }))
      }
      return
    }

    if (type === 'llm:chat_new') {
      const p = payload as { title?: string } | undefined
      const chat = { id: uuidv4(), user_id: clientInfo.id, title: p?.title || 'New Chat' }
      db.prepare('INSERT INTO llm_chats (id, user_id, title) VALUES (@id, @user_id, @title)').run(
        chat,
      )
      ws.send(
        JSON.stringify({
          type: 'llm:chat_created',
          chat: db.prepare('SELECT * FROM llm_chats WHERE id = ?').get(chat.id),
        }),
      )
      return
    }

    if (type === 'llm:chat_list') {
      const chats = db
        .prepare(
          `
        SELECT c.*, (SELECT content FROM llm_messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
        FROM llm_chats c WHERE c.user_id = ? ORDER BY c.updated_at DESC
      `,
        )
        .all(clientInfo.id)
      ws.send(JSON.stringify({ type: 'llm:chat_list_response', chats }))
      return
    }

    if (type === 'llm:chat_history') {
      const p = payload as { chatId?: string } | undefined
      if (!p?.chatId) return
      const chat = db
        .prepare('SELECT * FROM llm_chats WHERE id = ? AND user_id = ?')
        .get(p.chatId, clientInfo.id)
      if (!chat) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'Chat not found' }))
        return
      }
      const messages = db
        .prepare('SELECT * FROM llm_messages WHERE chat_id = ? ORDER BY created_at ASC')
        .all(p.chatId)
      ws.send(JSON.stringify({ type: 'llm:chat_history_response', chat, messages }))
      return
    }

    if (type === 'llm:chat_delete') {
      const p = payload as { chatId?: string } | undefined
      if (!p?.chatId) return
      const chat = db
        .prepare('SELECT id FROM llm_chats WHERE id = ? AND user_id = ?')
        .get(p.chatId, clientInfo.id)
      if (!chat) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'Chat not found' }))
        return
      }
      db.prepare('DELETE FROM llm_chats WHERE id = ?').run(p.chatId)
      ws.send(JSON.stringify({ type: 'llm:chat_deleted', chatId: p.chatId }))
      return
    }

    if (type === 'llm:files_list') {
      const files = db
        .prepare(
          'SELECT id, name, folder, mime_type as mimeType FROM company_files ORDER BY folder ASC, name ASC',
        )
        .all()
      ws.send(JSON.stringify({ type: 'llm:files_list_response', files }))
      return
    }

    if (type === 'llm:context_list') {
      ws.send(
        JSON.stringify({
          type: 'llm:context_list_response',
          contexts: AVAILABLE_CONTEXTS.map((key) => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
          })),
        }),
      )
      return
    }

    if (type === 'llm:chat_rename') {
      const p = payload as { chatId?: string; title?: string } | undefined
      if (!p?.chatId || !p?.title?.trim()) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'chatId and title are required' }))
        return
      }
      const chat = db
        .prepare('SELECT id FROM llm_chats WHERE id = ? AND user_id = ?')
        .get(p.chatId, clientInfo.id)
      if (!chat) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'Chat not found' }))
        return
      }
      db.prepare('UPDATE llm_chats SET title = ? WHERE id = ?').run(p.title.trim(), p.chatId)
      ws.send(JSON.stringify({ type: 'llm:chat_renamed', chatId: p.chatId, title: p.title.trim() }))
      return
    }

    if (type === 'llm:chat') {
      const p = payload as
        | {
            message?: string
            chatId?: string
            useCompanyData?: boolean
            maxTokens?: number
            temperature?: number
          }
        | undefined
      if (!p?.message?.trim()) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'message is required' }))
        return
      }

      let chatId = p.chatId
      if (chatId) {
        const exists = db
          .prepare('SELECT id FROM llm_chats WHERE id = ? AND user_id = ?')
          .get(chatId, clientInfo.id)
        if (!exists) {
          ws.send(JSON.stringify({ type: 'llm:error', error: 'Chat not found' }))
          return
        }
      } else {
        chatId = uuidv4()
        const title = p.message.slice(0, 60) + (p.message.length > 60 ? '…' : '')
        db.prepare('INSERT INTO llm_chats (id, user_id, title) VALUES (?, ?, ?)').run(
          chatId,
          clientInfo.id,
          title,
        )
      }

      const userMsgId = uuidv4()
      db.prepare('INSERT INTO llm_messages (id, chat_id, role, content) VALUES (?, ?, ?, ?)').run(
        userMsgId,
        chatId,
        'user',
        p.message,
      )

      ws.send(JSON.stringify({ type: 'llm:thinking', chatId, messageId: userMsgId }))

      try {
        const { getDataDir } = require('../db/database')
        const contextKeys = detectContext(p.message)
        const specificFileIds = extractFileMentions(p.message)
        const systemPrompt = buildSystemPrompt(
          db,
          getDataDir(),
          clientInfo.id,
          contextKeys,
          p.useCompanyData || false,
          specificFileIds,
        )

        const history = db
          .prepare(
            'SELECT role, content FROM llm_messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?',
          )
          .all(chatId, MAX_HISTORY) as { role: string; content: string }[]
        history.reverse()

        const llmMessages = [{ role: 'system', content: systemPrompt }, ...history]
        const result = await callLLM(llmMessages, p.maxTokens || 1024, p.temperature || 0.7)

        const assistantMsgId = uuidv4()
        db.prepare('INSERT INTO llm_messages (id, chat_id, role, content) VALUES (?, ?, ?, ?)').run(
          assistantMsgId,
          chatId,
          'assistant',
          result.text,
        )
        db.prepare("UPDATE llm_chats SET updated_at = datetime('now') WHERE id = ?").run(chatId)

        ws.send(
          JSON.stringify({
            type: 'llm:chat_response',
            chatId,
            message: {
              id: assistantMsgId,
              role: 'assistant',
              content: result.text,
              created_at: new Date().toISOString(),
            },
            model: result.model,
            usage: {
              prompt_tokens: result.prompt_tokens,
              completion_tokens: result.completion_tokens,
            },
            contextUsed: [...contextKeys],
          }),
        )
      } catch (err) {
        const error = err as Error
        log.error('LLMChat error', error.message)
        db.prepare('DELETE FROM llm_messages WHERE id = ?').run(userMsgId)
        ws.send(
          JSON.stringify({
            type: 'llm:error',
            chatId,
            error: error.message.includes('fetch')
              ? 'LLM server is offline — run: bash ~/task-hub/llm/start.sh'
              : error.message,
          }),
        )
      }
    }
  },
}

export default llmChatModule
