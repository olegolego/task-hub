const { v4: uuidv4 } = require('uuid')

const tasksModule = {
  name: 'tasks',
  messageTypes: ['task:create', 'task:update', 'task:complete', 'task:delete', 'task:assign'],

  init(db) {
    // Tables already created in database.js
  },

  async handle(message, { broadcast, broadcastToGroup, clients, clientInfo, ws, db }) {
    const { type, payload } = message

    if (type === 'task:create') {
      const task = {
        id: payload.id || uuidv4(),
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority || 'medium',
        status: 'todo',
        created_by: clientInfo.id,
        assigned_to: payload.assignedTo || null,
        group_id: payload.groupId || null,
        due_date: payload.dueDate || null,
        sort_order: Date.now(),
      }

      db.prepare(`
        INSERT INTO tasks (id, title, description, priority, status, created_by, assigned_to, group_id, due_date, sort_order)
        VALUES (@id, @title, @description, @priority, @status, @created_by, @assigned_to, @group_id, @due_date, @sort_order)
      `).run(task)

      const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id)
      const outMsg = { type: 'task:created', task: created }

      if (task.group_id) {
        broadcastToGroup(outMsg, task.group_id)
      } else {
        ws.send(JSON.stringify(outMsg))
        // Also notify assignee if different
        if (task.assigned_to && task.assigned_to !== clientInfo.id) {
          for (const [clientWs, info] of clients) {
            if (info.id === task.assigned_to) clientWs.send(JSON.stringify(outMsg))
          }
        }
      }
    }

    else if (type === 'task:update') {
      const { id, ...updates } = payload
      const fields = []
      const values = []

      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
      if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority) }
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
      if (updates.assignedTo !== undefined) { fields.push('assigned_to = ?'); values.push(updates.assignedTo) }
      if (updates.dueDate !== undefined) { fields.push('due_date = ?'); values.push(updates.dueDate) }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }

      fields.push("updated_at = datetime('now')")
      values.push(id)

      if (fields.length > 1) {
        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
      }

      const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
      const outMsg = { type: 'task:updated', task: updated }

      if (updated.group_id) broadcastToGroup(outMsg, updated.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'task:complete') {
      const { id, completed } = payload
      db.prepare("UPDATE tasks SET completed = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
        .run(completed ? 1 : 0, completed ? 'done' : 'todo', id)

      const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
      const outMsg = { type: 'task:updated', task: updated }

      if (updated.group_id) broadcastToGroup(outMsg, updated.group_id)
      else broadcast(outMsg)
    }

    else if (type === 'task:delete') {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(payload.id)
      if (task) {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(payload.id)
        const outMsg = { type: 'task:deleted', id: payload.id }
        if (task.group_id) broadcastToGroup(outMsg, task.group_id)
        else broadcast(outMsg)
      }
    }

    else if (type === 'task:assign') {
      const { id, assignedTo } = payload
      db.prepare("UPDATE tasks SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?")
        .run(assignedTo, id)

      const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
      const outMsg = { type: 'task:updated', task: updated }

      if (updated.group_id) broadcastToGroup(outMsg, updated.group_id)
      else broadcast(outMsg)
    }
  },
}

module.exports = tasksModule
