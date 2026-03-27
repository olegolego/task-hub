import { v4 as uuidv4 } from 'uuid'
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  deleteTaskSchema,
  assignTaskSchema,
} from '@task-hub/shared'
import { validatePayload } from '../middleware/validate.js'
import { canModifyTask, canDeleteResource } from '../auth/permissions.js'
import { createLogger } from '../utils/logger.js'
import type { ServerModule, ModuleContext } from './types.js'

const log = createLogger('tasks')

const tasksModule: ServerModule = {
  name: 'tasks',
  messageTypes: ['task:create', 'task:update', 'task:complete', 'task:delete', 'task:assign'],

  init(_db) {},

  async handle(message, ctx: ModuleContext) {
    const { type, payload } = message
    const { broadcast, broadcastToGroup, clients, clientInfo, ws, db } = ctx

    if (type === 'task:create') {
      const data = validatePayload(createTaskSchema, payload, ws)
      if (!data) return

      const task = {
        id: data.id || uuidv4(),
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: 'todo',
        created_by: clientInfo.id,
        assigned_to: data.assignedTo || null,
        group_id: data.groupId || null,
        due_date: data.dueDate || null,
        sort_order: Date.now(),
      }

      db.prepare(
        `
        INSERT INTO tasks (id, title, description, priority, status, created_by, assigned_to, group_id, due_date, sort_order)
        VALUES (@id, @title, @description, @priority, @status, @created_by, @assigned_to, @group_id, @due_date, @sort_order)
      `,
      ).run(task)

      const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)
      const outMsg = { type: 'task:created', task: created }

      if (task.group_id) {
        broadcastToGroup(outMsg, task.group_id)
      } else {
        ws.send(JSON.stringify(outMsg))
        if (task.assigned_to && task.assigned_to !== clientInfo.id) {
          for (const [clientWs, info] of clients) {
            if (info.id === task.assigned_to) clientWs.send(JSON.stringify(outMsg))
          }
        }
      }
      log.info('Task created', { id: task.id, title: task.title })
    } else if (type === 'task:update') {
      const data = validatePayload(updateTaskSchema, payload, ws)
      if (!data) return

      const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as
        | Record<string, unknown>
        | undefined
      if (!existing) return

      if (
        !canModifyTask(
          db,
          clientInfo.id,
          existing as { created_by: string; assigned_to?: string | null; group_id?: string | null },
          clientInfo,
        )
      ) {
        ws.send(JSON.stringify({ type: 'error', error: 'Permission denied' }))
        return
      }

      const fields: string[] = []
      const values: unknown[] = []

      if (data.title !== undefined) {
        fields.push('title = ?')
        values.push(data.title)
      }
      if (data.priority !== undefined) {
        fields.push('priority = ?')
        values.push(data.priority)
      }
      if (data.status !== undefined) {
        fields.push('status = ?')
        values.push(data.status)
      }
      if (data.assignedTo !== undefined) {
        fields.push('assigned_to = ?')
        values.push(data.assignedTo)
      }
      if (data.dueDate !== undefined) {
        fields.push('due_date = ?')
        values.push(data.dueDate)
      }
      if (data.description !== undefined) {
        fields.push('description = ?')
        values.push(data.description)
      }

      fields.push("updated_at = datetime('now')")
      values.push(data.id)

      if (fields.length > 1) {
        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      }

      const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id)
      const outMsg = { type: 'task:updated', task: updated }

      const updatedTask = updated as Record<string, unknown> | undefined
      if (updatedTask?.group_id) broadcastToGroup(outMsg, updatedTask.group_id as string)
      else broadcast(outMsg)
    } else if (type === 'task:complete') {
      const data = validatePayload(completeTaskSchema, payload, ws)
      if (!data) return

      db.prepare(
        "UPDATE tasks SET completed = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(data.completed ? 1 : 0, data.completed ? 'done' : 'todo', data.id)

      const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as
        | Record<string, unknown>
        | undefined
      const outMsg = { type: 'task:updated', task: updated }

      if (updated?.group_id) broadcastToGroup(outMsg, updated.group_id as string)
      else broadcast(outMsg)
    } else if (type === 'task:delete') {
      const data = validatePayload(deleteTaskSchema, payload, ws)
      if (!data) return

      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as
        | Record<string, unknown>
        | undefined
      if (task) {
        if (!canDeleteResource(clientInfo.id, task.created_by as string, clientInfo)) {
          ws.send(JSON.stringify({ type: 'error', error: 'Permission denied' }))
          return
        }
        db.prepare('DELETE FROM tasks WHERE id = ?').run(data.id)
        const outMsg = { type: 'task:deleted', id: data.id }
        if (task.group_id) broadcastToGroup(outMsg, task.group_id as string)
        else broadcast(outMsg)
        log.info('Task deleted', { id: data.id })
      }
    } else if (type === 'task:assign') {
      const data = validatePayload(assignTaskSchema, payload, ws)
      if (!data) return

      db.prepare("UPDATE tasks SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?").run(
        data.assignedTo,
        data.id,
      )

      const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(data.id) as
        | Record<string, unknown>
        | undefined
      const outMsg = { type: 'task:updated', task: updated }

      if (updated?.group_id) broadcastToGroup(outMsg, updated.group_id as string)
      else broadcast(outMsg)
    }
  },
}

export default tasksModule
