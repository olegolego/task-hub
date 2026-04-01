import React from 'react'
import IdeaCard from './IdeaCard'
import IdeaComposer from './IdeaComposer'
import { useIdeaStore } from '../../store/ideaStore'

interface IdeasBoardProps {
  groupId?: string | null
}

export default function IdeasBoard({ groupId = null }: IdeasBoardProps) {
  const { getSortedIdeas } = useIdeaStore()
  const ideas = getSortedIdeas(groupId)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <IdeaComposer groupId={groupId} />

      {ideas.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: 'var(--text-secondary)',
            padding: 24,
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.4 }}
          >
            <line x1="9" y1="18" x2="15" y2="18" />
            <line x1="10" y1="22" x2="14" y2="22" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
          </svg>
          <span style={{ fontSize: 13, textAlign: 'center', opacity: 0.6 }}>
            No ideas yet.
            <br />
            Share your first one above!
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 6, paddingBottom: 8 }}>
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  )
}
