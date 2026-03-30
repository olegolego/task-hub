// @ts-nocheck
import { create } from 'zustand'
import { useTaskStore } from './taskStore'
import { useIdeaStore } from './ideaStore'
import { useUserStore } from './userStore'
import { useFilesStore } from './filesStore'

export const useSearchStore = create((set, get) => ({
  query: '',
  results: { tasks: [], ideas: [], users: [], files: [] },

  setQuery: (query) => {
    set({ query })
    if (!query.trim()) {
      set({ results: { tasks: [], ideas: [], users: [], files: [] } })
      return
    }
    get().performSearch(query.trim().toLowerCase())
  },

  performSearch: (q) => {
    const tasks = useTaskStore
      .getState()
      .tasks.filter(
        (t) => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
      )
      .slice(0, 20)

    const ideas = useIdeaStore
      .getState()
      .ideas.filter((i) => i.title?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q))
      .slice(0, 20)

    const users = useUserStore
      .getState()
      .users.filter((u) => u.display_name?.toLowerCase().includes(q))
      .slice(0, 10)

    const files = useFilesStore
      .getState()
      .files.filter((f) => f.name?.toLowerCase().includes(q))
      .slice(0, 20)

    set({ results: { tasks, ideas, users, files } })
  },

  clear: () => set({ query: '', results: { tasks: [], ideas: [], users: [], files: [] } }),
}))
