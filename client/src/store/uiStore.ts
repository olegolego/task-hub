// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useUIStore = create((set, get) => ({
  theme: 'dark',
  isPinned: true,
  showCompleted: true,
  activePanel: 'tasks',
  showSearch: false,
  showSettings: false,
  showTaskDetail: null, // task ID or null

  setActivePanel: (panel) => set({ activePanel: panel }),

  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  closeSearch: () => set({ showSearch: false }),

  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
  closeSettings: () => set({ showSettings: false }),

  openTaskDetail: (taskId) => set({ showTaskDetail: taskId }),
  closeTaskDetail: () => set({ showTaskDetail: null }),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: newTheme })
    // Persist theme to config
    ipc.saveConfig({ theme: newTheme })
  },

  toggleShowCompleted: () => set((s) => ({ showCompleted: !s.showCompleted })),

  togglePin: async () => {
    const pinned = await ipc.togglePin()
    set({ isPinned: pinned })
  },

  minimizeWindow: () => ipc.minimizeWindow(),
  closeWindow: () => ipc.closeWindow(),

  loadSettings: async () => {
    const pinned = await ipc.getPinState()
    const config = await ipc.getConfig()
    set({
      isPinned: pinned,
      theme: config?.theme || 'dark',
    })
  },
}))
