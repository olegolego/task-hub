const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')

const LLM_SERVER_URL = process.env.LLM_SERVER_URL || 'http://localhost:8766'

// ---------------------------------------------------------------------------
// Context builders — fetch relevant data from DB to include in the prompt
// ---------------------------------------------------------------------------

function buildTasksContext(db, userId) {
  const tasks = db.prepare(`
    SELECT t.*, u.display_name as assigned_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.created_by = ? OR t.assigned_to = ?
    ORDER BY t.created_at DESC LIMIT 50
  `).all(userId, userId)

  if (!tasks.length) return ''
  const lines = tasks.map(t =>
    `- [${t.status}] ${t.title}` +
    (t.priority ? ` (${t.priority})` : '') +
    (t.assigned_name ? ` → assigned to ${t.assigned_name}` : '') +
    (t.description ? `\n  ${t.description}` : '')
  )
  return `## Tasks\n${lines.join('\n')}`
}

function buildIdeasContext(db) {
  const ideas = db.prepare(`
    SELECT i.*, u.display_name as author
    FROM ideas i
    JOIN users u ON i.created_by = u.id
    WHERE i.status != 'archived'
    ORDER BY i.created_at DESC LIMIT 30
  `).all()

  if (!ideas.length) return ''
  const lines = ideas.map(i =>
    `- [${i.status}] "${i.title}" by ${i.author}` +
    (i.body ? `\n  ${i.body}` : '')
  )
  return `## Ideas\n${lines.join('\n')}`
}

function buildGroupMessagesContext(db, userId) {
  const messages = db.prepare(`
    SELECT gm.body, gm.created_at, u.display_name, g.name as group_name
    FROM group_messages gm
    JOIN users u ON gm.from_user_id = u.id
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.group_id IN (
      SELECT group_id FROM group_members WHERE user_id = ?
    )
    ORDER BY gm.created_at DESC LIMIT 50
  `).all(userId)

  if (!messages.length) return ''
  const lines = messages.reverse().map(m =>
    `[${m.group_name}] ${m.display_name}: ${m.body}`
  )
  return `## Recent Group Messages\n${lines.join('\n')}`
}

function buildCompanyFilesContext(db, dataDir, fileIds) {
  let query = 'SELECT * FROM company_files'
  let rows
  if (fileIds && fileIds.length) {
    const placeholders = fileIds.map(() => '?').join(',')
    rows = db.prepare(`${query} WHERE id IN (${placeholders})`).all(...fileIds)
  } else {
    rows = db.prepare(`${query} ORDER BY created_at DESC LIMIT 20`).all()
  }

  if (!rows.length) return ''

  const parts = []
  for (const file of rows) {
    // Only include text-readable files
    const textTypes = ['text/', 'application/json', 'application/xml', 'application/javascript']
    const isText = textTypes.some(t => (file.mime_type || '').startsWith(t)) ||
                   /\.(txt|md|js|ts|py|json|yaml|yml|csv|html|css|sh|sql)$/i.test(file.name)
    if (!isText) {
      parts.push(`### File: ${file.name} (${file.mime_type || 'binary'} — content not readable)`)
      continue
    }
    try {
      const filePath = path.join(dataDir, 'uploads', file.stored_path)
      const content = fs.readFileSync(filePath, 'utf8').slice(0, 4000)
      parts.push(`### File: ${file.name}\n\`\`\`\n${content}\n\`\`\``)
    } catch {
      parts.push(`### File: ${file.name} (could not read)`)
    }
  }
  return `## Company Files\n${parts.join('\n\n')}`
}

// ---------------------------------------------------------------------------
// Call the Python inference server
// ---------------------------------------------------------------------------
async function callLLM(messages, maxTokens = 1024, temperature = 0.7) {
  const res = await fetch(`${LLM_SERVER_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(300_000), // 5 min — first call compiles kernels
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM server error ${res.status}: ${err}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
const llmModule = {
  name: 'llm',
  messageTypes: ['llm:ask', 'llm:status'],

  init(db) {
    // No extra DB setup needed
  },

  async handle(message, { clientInfo, ws, db }) {
    const { type, payload } = message

    // ---- llm:status -------------------------------------------------------
    if (type === 'llm:status') {
      try {
        const res = await fetch(`${LLM_SERVER_URL}/health`)
        const data = await res.json()
        ws.send(JSON.stringify({ type: 'llm:status_response', status: data.status, model: data.model }))
      } catch {
        ws.send(JSON.stringify({ type: 'llm:status_response', status: 'offline', model: null }))
      }
      return
    }

    // ---- llm:ask ----------------------------------------------------------
    if (type === 'llm:ask') {
      const { question, context: contextTypes = ['tasks'], fileIds } = payload

      if (!question || !question.trim()) {
        ws.send(JSON.stringify({ type: 'llm:error', error: 'question is required' }))
        return
      }

      // Notify client that we're working
      const requestId = uuidv4()
      ws.send(JSON.stringify({ type: 'llm:thinking', requestId }))

      try {
        // Get server data dir for file reading
        const { getDataDir } = require('../db/database')
        const dataDir = getDataDir()

        // Build context sections
        const sections = []
        if (contextTypes.includes('tasks') || contextTypes.includes('all')) {
          sections.push(buildTasksContext(db, clientInfo.id))
        }
        if (contextTypes.includes('ideas') || contextTypes.includes('all')) {
          sections.push(buildIdeasContext(db))
        }
        if (contextTypes.includes('messages') || contextTypes.includes('all')) {
          sections.push(buildGroupMessagesContext(db, clientInfo.id))
        }
        if (contextTypes.includes('files') || contextTypes.includes('all')) {
          sections.push(buildCompanyFilesContext(db, dataDir, fileIds || []))
        }

        const contextText = sections.filter(Boolean).join('\n\n')

        const systemPrompt = contextText
          ? `You are a helpful assistant integrated into TaskHub, a team collaboration platform.
Use the following data from the system to answer the user's question accurately and concisely.

${contextText}`
          : `You are a helpful assistant integrated into TaskHub, a team collaboration platform.`

        const result = await callLLM(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          payload.maxTokens || 1024,
          payload.temperature || 0.7
        )

        ws.send(JSON.stringify({
          type: 'llm:response',
          requestId,
          answer: result.text,
          model: result.model,
          usage: { prompt_tokens: result.prompt_tokens, completion_tokens: result.completion_tokens },
        }))
      } catch (err) {
        console.error('[LLM] Error:', err.message)
        ws.send(JSON.stringify({
          type: 'llm:error',
          requestId,
          error: err.message.includes('fetch') ? 'LLM server is offline' : err.message,
        }))
      }
    }
  },
}

module.exports = llmModule
