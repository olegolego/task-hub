// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import { parseTaskInput } from '../utils/constants'
import { v4 as uuidv4 } from 'uuid'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  theme: 'dark',
  showCompleted: true,
  activeCategory: 'all',
  isPinned: true,
  inputRef: null,

  setInputRef: (ref) => set({ inputRef: ref }),

  focusInput: () => {
    get().inputRef?.focus()
  },

  // Called by messageBus when sync:response arrives
  setTasks: (tasks) => set({ tasks }),

  // Called by messageBus on task:created
  addTaskFromServer: (task) =>
    set((s) => ({
      tasks: [task, ...s.tasks.filter((t) => t.id !== task.id)],
    })),

  // Called by messageBus on task:updated
  updateTaskFromServer: (task) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === task.id ? task : t)),
    })),

  // Called by messageBus on task:deleted
  removeTaskFromServer: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
    })),

  loadSettings: async () => {
    const pinned = await ipc.getPinState()
    set({ isPinned: pinned })
  },

  addTask: async (title, priority = 'medium', groupId = null) => {
    const id = uuidv4()
    // Optimistic: add locally immediately
    const optimistic = {
      id,
      title,
      priority,
      completed: 0,
      status: 'todo',
      group_id: groupId,
      assigned_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sort_order: Date.now(),
    }
    set((s) => ({ tasks: [optimistic, ...s.tasks] }))

    // Send to server
    ipc.sendMessage({
      type: 'task:create',
      payload: { id, title, priority, groupId },
    })
  },

  toggleTask: (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    const completed = !task.completed
    // Optimistic
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, completed: completed ? 1 : 0, status: completed ? 'done' : 'todo' }
          : t,
      ),
    }))
    ipc.sendMessage({ type: 'task:complete', payload: { id, completed } })
  },

  updateTaskTitle: (id, title) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, title } : t)) }))
    ipc.sendMessage({ type: 'task:update', payload: { id, title } })
  },

  updateTaskPriority: (id, priority) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, priority } : t)) }))
    ipc.sendMessage({ type: 'task:update', payload: { id, priority } })
  },

  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    ipc.sendMessage({ type: 'task:delete', payload: { id } })
  },

  setActiveCategory: (cat) => set({ activeCategory: cat }),

  toggleShowCompleted: () => set((s) => ({ showCompleted: !s.showCompleted })),

  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  togglePin: async () => {
    const pinned = await ipc.togglePin()
    set({ isPinned: pinned })
  },

  minimizeWindow: () => ipc.minimizeWindow(),
  closeWindow: () => ipc.closeWindow(),

  getFilteredTasks: (groupId = null) => {
    const { tasks, showCompleted } = get()
    return tasks
      .filter((t) => (groupId === null ? !t.group_id : t.group_id === groupId))
      .filter((t) => showCompleted || !t.completed)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed
        const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
        const pd = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2)
        if (pd !== 0) return pd
        return new Date(a.created_at) - new Date(b.created_at)
      })
  },
}))
