import { v4 as uuidv4 } from 'uuid'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from '../utils/logger.js'
import { getDataDir } from '../db/database.js'
import { config } from '../config.js'
import type Database from 'better-sqlite3'
import type { ServerModule, ModuleContext } from './types.js'

const log = createLogger('llm')

const LLM_SERVER_URL = config.LLM_SERVER_URL

function buildTasksContext(db: Database.Database, userId: string): string {
  const tasks = db
    .prepare(
      `
    SELECT t.*, u.display_name as assigned_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.created_by = ? OR t.assigned_to = ?
    ORDER BY t.created_at DESC LIMIT 50
  `,
    )
    .all(userId, userId) as Record<string, unknown>[]
  if (!tasks.length) return ''
  const lines = tasks.map(
    (t) =>
      `- [${t.status}] ${t.title}` +
      (t.priority ? ` (${t.priority})` : '') +
      (t.assigned_name ? ` → assigned to ${t.assigned_name}` : '') +
      (t.description ? `\n  ${t.description}` : ''),
  )
  return `## Tasks\n${lines.join('\n')}`
}

function buildIdeasContext(db: Database.Database): string {
  const ideas = db
    .prepare(
      `
    SELECT i.*, u.display_name as author
    FROM ideas i JOIN users u ON i.created_by = u.id
    WHERE i.status != 'archived'
    ORDER BY i.created_at DESC LIMIT 30
  `,
    )
    .all() as Record<string, unknown>[]
  if (!ideas.length) return ''
  const lines = ideas.map(
    (i) => `- [${i.status}] "${i.title}" by ${i.author}` + (i.body ? `\n  ${i.body}` : ''),
  )
  return `## Ideas\n${lines.join('\n')}`
}

function buildGroupMessagesContext(db: Database.Database, userId: string): string {
  const messages = db
    .prepare(
      `
    SELECT gm.body, gm.created_at, u.display_name, g.name as group_name
    FROM group_messages gm
    JOIN users u ON gm.from_user_id = u.id
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
    ORDER BY gm.created_at DESC LIMIT 50
  `,
    )
    .all(userId) as Record<string, unknown>[]
  if (!messages.length) return ''
  const lines = messages.reverse().map((m) => `[${m.group_name}] ${m.display_name}: ${m.body}`)
  return `## Recent Group Messages\n${lines.join('\n')}`
}

function buildCompanyFilesContext(
  db: Database.Database,
  dataDir: string,
  fileIds: string[],
): string {
  let rows: Record<string, unknown>[]
  if (fileIds.length > 0) {
    const placeholders = fileIds.map(() => '?').join(',')
    rows = db
      .prepare(`SELECT * FROM company_files WHERE id IN (${placeholders})`)
      .all(...fileIds) as Record<string, unknown>[]
  } else {
    rows = db
      .prepare('SELECT * FROM company_files ORDER BY created_at DESC LIMIT 20')
      .all() as Record<string, unknown>[]
  }
  if (!rows.length) return ''

  const parts: string[] = []
  for (const file of rows) {
    const fullPath = path.join(dataDir, 'uploads', file.stored_path as string)
    const isPdf =
      ((file.mime_type as string) || '').includes('pdf') || /\.pdf$/i.test(file.name as string)
    if (isPdf) {
      try {
        const text = execFileSync('pdftotext', [fullPath, '-'], {
          timeout: 10000,
          maxBuffer: 2 * 1024 * 1024,
        })
          .toString('utf8')
          .trim()
        parts.push(`### File: ${file.name}\n\`\`\`\n${text.slice(0, 4000)}\n\`\`\``)
      } catch {
        parts.push(`### File: ${file.name} (PDF — could not extract text)`)
      }
      continue
    }
    const textTypes = ['text/', 'application/json', 'application/xml', 'application/javascript']
    const isText =
      textTypes.some((t) => ((file.mime_type as string) || '').startsWith(t)) ||
      /\.(txt|md|js|ts|py|json|yaml|yml|csv|html|css|sh|sql)$/i.test(file.name as string)
    if (!isText) {
      parts.push(`### File: ${file.name} (${file.mime_type || 'binary'} — content not readable)`)
      continue
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf8').slice(0, 4000)
      parts.push(`### File: ${file.name}\n\`\`\`\n${content}\n\`\`\``)
    } catch {
      parts.push(`### File: ${file.name} (could not read)`)
    }
  }
  return `## Company Files\n${parts.join('\n\n')}`
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
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM server error ${res.status}: ${err}`)
  }
  return res.json() as Promise<{
    text: string
    model: string
    prompt_tokens: number
    completion_tokens: number
  }>
}

const llmModule: ServerModule = {
  name: 'llm',
  messageTypes: ['llm:ask', 'llm:status'],

  init(_db) {},

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

    if (type === 'llm:ask') {
      const p = payload as {
        question?: string
        context?: string[]
        fileIds?: string[]
        maxTokens?: number
        temperature?: number
      }
      if (!p?.question?.trim()) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'question is required' }))
        return
      }

      const requestId = uuidv4()
      ws.send(JSON.stringify({ type: 'llm:thinking', requestId }))

      try {
        const dataDir = getDataDir()
        const contextTypes = p.context || ['tasks']

        const sections: string[] = []
        if (contextTypes.includes('tasks') || contextTypes.includes('all'))
          sections.push(buildTasksContext(db, clientInfo.id))
        if (contextTypes.includes('ideas') || contextTypes.includes('all'))
          sections.push(buildIdeasContext(db))
        if (contextTypes.includes('messages') || contextTypes.includes('all'))
          sections.push(buildGroupMessagesContext(db, clientInfo.id))
        if (contextTypes.includes('files') || contextTypes.includes('all'))
          sections.push(buildCompanyFilesContext(db, dataDir, p.fileIds || []))

        const contextText = sections.filter(Boolean).join('\n\n')
        const systemPrompt = contextText
          ? `You are a helpful assistant integrated into TaskHub, a team collaboration platform.\nUse the following data from the system to answer the user's question accurately and concisely.\n\n${contextText}`
          : 'You are a helpful assistant integrated into TaskHub, a team collaboration platform.'

        const result = await callLLM(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: p.question },
          ],
          p.maxTokens || 1024,
          p.temperature || 0.7,
        )

        ws.send(
          JSON.stringify({
            type: 'llm:response',
            requestId,
            answer: result.text,
            model: result.model,
            usage: {
              prompt_tokens: result.prompt_tokens,
              completion_tokens: result.completion_tokens,
            },
          }),
        )
      } catch (err) {
        const error = err as Error
        log.error('LLM error', error.message)
        ws.send(
          JSON.stringify({
            type: 'llm:error',
            requestId,
            error: error.message.includes('fetch') ? 'LLM server is offline' : error.message,
          }),
        )
      }
    }
  },
}

export default llmModule
