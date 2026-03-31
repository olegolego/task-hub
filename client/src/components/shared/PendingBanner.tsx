// @ts-nocheck
import React from 'react'
import { useConnectionStore } from '../../store/connectionStore'

export default function PendingBanner() {
  const myStatus = useConnectionStore((s) => s.myStatus)

  if (myStatus !== 'pending') return null

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(255, 209, 102, 0.12), rgba(247, 37, 133, 0.12))',
        border: '1px solid rgba(255, 209, 102, 0.2)',
        borderRadius: 8,
        padding: '14px 16px',
        margin: '12px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffd166"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ffd166' }}>Awaiting Approval</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
        Your account is pending admin approval. You&apos;ll get full access once an administrator
        approves your request.
      </p>

      {/* Animated waiting dots */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ffd166',
              opacity: 0.4,
              animation: `pendingPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes pendingPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
