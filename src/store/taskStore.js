import { create } from 'zustand'
import { ipc } from '../utils/ipc'

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

  loadTasks: async () => {
    const tasks = await ipc.getTasks()
    set({ tasks })
  },

  loadSettings: async () => {
    const settings = await ipc.getSettings()
    set({
      theme: settings.theme ?? 'dark',
      showCompleted: settings.showCompleted ?? true,
      activeCategory: settings.activeCategory ?? 'all',
      isPinned: true,
    })
    const pinned = await ipc.getPinState()
    set({ isPinned: pinned })
  },

  addTask: async (title, priority = 'medium', category) => {
    const { activeCategory } = get()
    const cat = category ?? (activeCategory !== 'all' ? activeCategory : 'general')
    const task = await ipc.createTask({ title, priority, category: cat })
    if (task) set((s) => ({ tasks: [task, ...s.tasks] }))
  },

  toggleTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    const updated = await ipc.updateTask({ id, completed: task.completed ? 0 : 1 })
    if (updated) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
      }))
    }
  },

  updateTaskTitle: async (id, title) => {
    const updated = await ipc.updateTask({ id, title })
    if (updated) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
      }))
    }
  },

  updateTaskPriority: async (id, priority) => {
    const updated = await ipc.updateTask({ id, priority })
    if (updated) {
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
      }))
    }
  },

  deleteTask: async (id) => {
    await ipc.deleteTask(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },

  setActiveCategory: async (cat) => {
    set({ activeCategory: cat })
    await ipc.updateSettings({ activeCategory: cat })
  },

  toggleShowCompleted: async () => {
    const next = !get().showCompleted
    set({ showCompleted: next })
    await ipc.updateSettings({ showCompleted: next })
  },

  toggleTheme: async () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: next })
    await ipc.updateSettings({ theme: next })
  },

  togglePin: async () => {
    const pinned = await ipc.togglePin()
    set({ isPinned: pinned })
  },

  minimizeWindow: () => ipc.minimizeWindow(),
  closeWindow: () => ipc.closeWindow(),

  getFilteredTasks: () => {
    const { tasks, activeCategory, showCompleted } = get()
    return tasks
      .filter((t) => activeCategory === 'all' || t.category === activeCategory)
      .filter((t) => showCompleted || !t.completed)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed
        const pOrder = { high: 0, medium: 1, low: 2 }
        const pd = pOrder[a.priority] - pOrder[b.priority]
        if (pd !== 0) return pd
        return new Date(a.created_at) - new Date(b.created_at)
      })
  },
}))
