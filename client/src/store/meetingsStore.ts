import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import type { AttendeeStatus } from '@task-hub/shared'

/** Local meeting shape — uses camelCase and epoch-ms numbers for dates */
interface ClientMeeting {
  id: string
  title: string
  description: string
  startTime: number
  endTime: number
  createdBy: string
  groupId?: string | null
  attendees?: MeetingAttendeeClient[]
  createdAt: number
}

interface MeetingAttendeeClient {
  userId: string
  status: AttendeeStatus
}

interface MeetingsStoreState {
  meetings: ClientMeeting[]
}

interface MeetingsStoreActions {
  setMeetings: (meetings: ClientMeeting[]) => void
  addMeeting: (meeting: ClientMeeting) => void
  updateMeeting: (meeting: ClientMeeting) => void
  removeMeeting: (meetingId: string) => void
  loadMeetings: () => void
  createMeeting: (params: {
    title: string
    description: string
    startTime: number
    endTime: number
    attendeeIds: string[]
    groupId?: string | null
  }) => void
  respondToMeeting: (meetingId: string, status: AttendeeStatus | string) => void
  deleteMeeting: (meetingId: string) => void
  getUpcoming: () => ClientMeeting[]
}

export const useMeetingsStore = create<MeetingsStoreState & MeetingsStoreActions>()((set, get) => ({
  meetings: [],

  setMeetings: (meetings) => set({ meetings }),

  addMeeting: (meeting) =>
    set((s) => ({
      meetings: [meeting, ...s.meetings.filter((m) => m.id !== meeting.id)].sort(
        (a, b) => a.startTime - b.startTime,
      ),
    })),

  updateMeeting: (meeting) =>
    set((s) => ({
      meetings: s.meetings.map((m) => (m.id === meeting.id ? meeting : m)),
    })),

  removeMeeting: (meetingId) =>
    set((s) => ({
      meetings: s.meetings.filter((m) => m.id !== meetingId),
    })),

  loadMeetings: () => {
    ipc.sendMessage({ type: 'meeting:list' })
  },

  createMeeting: ({ title, description, startTime, endTime, attendeeIds, groupId }) => {
    ipc.sendMessage({
      type: 'meeting:create',
      payload: { title, description, startTime, endTime, attendeeIds, groupId },
    })
  },

  respondToMeeting: (meetingId, status) => {
    ipc.sendMessage({ type: 'meeting:respond', payload: { meetingId, status } })
  },

  deleteMeeting: (meetingId) => {
    ipc.sendMessage({ type: 'meeting:delete', payload: { meetingId } })
  },

  getUpcoming: () => {
    const now = Date.now()
    return get()
      .meetings.filter((m) => m.endTime > now)
      .slice(0, 10)
  },
}))
