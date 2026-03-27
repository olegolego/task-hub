// @ts-nocheck
import { create } from 'zustand'
import { ipc } from '../utils/ipc'
import { v4 as uuidv4 } from 'uuid'

export const useIdeaStore = create((set, get) => ({
  ideas: [],
  commentsByIdea: {}, // ideaId → Comment[]

  setIdeas: (ideas) => set({ ideas }),

  addIdeaFromServer: (idea) =>
    set((s) => ({
      ideas: [idea, ...s.ideas.filter((i) => i.id !== idea.id)],
    })),

  updateIdeaFromServer: (idea) =>
    set((s) => ({
      ideas: s.ideas.map((i) => (i.id === idea.id ? { ...i, ...idea } : i)),
    })),

  applyVoteFromServer: ({ ideaId, userId, vote, voteCount }) =>
    set((s) => ({
      ideas: s.ideas.map((i) => (i.id === ideaId ? { ...i, vote_count: voteCount } : i)),
    })),

  postIdea: (title, body = '', groupId = null, category = 'general') => {
    const id = uuidv4()
    const optimistic = {
      id,
      title,
      body,
      group_id: groupId,
      category,
      status: 'open',
      pinned: 0,
      vote_count: 0,
      comment_count: 0,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ ideas: [optimistic, ...s.ideas] }))
    ipc.sendMessage({ type: 'idea:post', payload: { id, title, body, groupId, category } })
  },

  voteIdea: (ideaId, vote) => {
    // Optimistic local vote count adjustment
    const idea = get().ideas.find((i) => i.id === ideaId)
    if (idea) {
      set((s) => ({
        ideas: s.ideas.map((i) =>
          i.id === ideaId ? { ...i, vote_count: (i.vote_count || 0) + vote } : i,
        ),
      }))
    }
    ipc.sendMessage({ type: 'idea:vote', payload: { ideaId, vote } })
  },

  changeIdeaStatus: (ideaId, status) => {
    set((s) => ({
      ideas: s.ideas.map((i) => (i.id === ideaId ? { ...i, status } : i)),
    }))
    ipc.sendMessage({ type: 'idea:status', payload: { ideaId, status } })
  },

  setComments: (ideaId, comments) =>
    set((s) => ({
      commentsByIdea: { ...s.commentsByIdea, [ideaId]: comments },
    })),

  addComment: (comment, commentCount) =>
    set((s) => {
      const existing = s.commentsByIdea[comment.idea_id] ?? []
      const deduped = existing.some((c) => c.id === comment.id) ? existing : [...existing, comment]
      return {
        commentsByIdea: { ...s.commentsByIdea, [comment.idea_id]: deduped },
        ideas: s.ideas.map((i) =>
          i.id === comment.idea_id
            ? { ...i, comment_count: commentCount ?? (i.comment_count || 0) + 1 }
            : i,
        ),
      }
    }),

  loadComments: (ideaId) => {
    ipc.sendMessage({ type: 'idea:comments_load', payload: { ideaId } })
  },

  postComment: (ideaId, body) => {
    if (!body.trim()) return
    ipc.sendMessage({ type: 'idea:comment', payload: { ideaId, body } })
  },

  getSortedIdeas: (groupId = null) => {
    const { ideas } = get()
    return ideas
      .filter((i) => (groupId === null ? !i.group_id : i.group_id === groupId))
      .filter((i) => i.status !== 'archived')
      .sort((a, b) => {
        if (b.pinned !== a.pinned) return b.pinned - a.pinned
        return (b.vote_count || 0) - (a.vote_count || 0)
      })
  },
}))
