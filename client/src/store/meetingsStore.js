import { create } from 'zustand'
import { ipc } from '../utils/ipc'

export const useMeetingsStore = create((set, get) => ({
  meetings: [],

  setMeetings: (meetings) => set({ meetings }),

  addMeeting: (meeting) => set((s) => ({
    meetings: [meeting, ...s.meetings.filter(m => m.id !== meeting.id)]
      .sort((a, b) => a.startTime - b.startTime),
  })),

  updateMeeting: (meeting) => set((s) => ({
    meetings: s.meetings.map(m => m.id === meeting.id ? meeting : m),
  })),

  removeMeeting: (meetingId) => set((s) => ({
    meetings: s.meetings.filter(m => m.id !== meetingId),
  })),

  loadMeetings: () => {
    ipc.sendMessage({ type: 'meeting:list' })
  },

  createMeeting: ({ title, description, startTime, endTime, attendeeIds, groupId }) => {
    ipc.sendMessage({ type: 'meeting:create', payload: { title, description, startTime, endTime, attendeeIds, groupId } })
  },

  respondToMeeting: (meetingId, status) => {
    ipc.sendMessage({ type: 'meeting:respond', payload: { meetingId, status } })
  },

  deleteMeeting: (meetingId) => {
    ipc.sendMessage({ type: 'meeting:delete', payload: { meetingId } })
  },

  getUpcoming: () => {
    const now = Date.now()
    return get().meetings.filter(m => m.endTime > now).slice(0, 10)
  },
}))
