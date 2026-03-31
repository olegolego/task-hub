// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useActivityStore = create((set, _get) => ({
  activities: [],
  loading: false,

  setActivities: (activities) => set({ activities, loading: false }),

  addActivity: (activity) =>
    set((s) => ({
      activities: [activity, ...s.activities.filter((a) => a.id !== activity.id)].slice(0, 100),
    })),

  loadActivities: (limit = 50) => {
    set({ loading: true })
    ipc.sendMessage({ type: 'activity:list', payload: { limit } })
  },
}))
