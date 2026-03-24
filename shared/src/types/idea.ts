import type { IdeaStatusKey } from '../index.js'

export interface Idea {
  id: string
  title: string
  body?: string | null
  created_by: string
  group_id?: string | null
  category: string
  status: IdeaStatusKey
  pinned: number
  created_at: string
  updated_at: string
}

export interface IdeaVote {
  idea_id: string
  user_id: string
  vote: -1 | 1
  created_at: string
}

export interface IdeaComment {
  id: string
  idea_id: string
  user_id: string
  body: string
  created_at: string
}
