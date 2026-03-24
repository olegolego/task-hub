export type AttendeeStatus = 'pending' | 'accepted' | 'declined'

export interface Meeting {
  id: string
  title: string
  description: string
  start_time: number
  end_time: number
  created_by: string
  group_id?: string | null
  created_at: number
}

export interface MeetingAttendee {
  meeting_id: string
  user_id: string
  status: AttendeeStatus
}
