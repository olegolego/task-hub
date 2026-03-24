// @ts-nocheck
import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a2e',
            color: '#edf2f4',
            padding: 24,
            gap: 12,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef476f"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#ef476f', margin: 0 }}>
            Rendering Error
          </p>
          <pre
            style={{
              fontSize: 11,
              color: '#8d99ae',
              background: '#22223b',
              borderRadius: 6,
              padding: '10px 14px',
              maxWidth: '100%',
              overflow: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              background: '#4cc9f0',
              border: 'none',
              borderRadius: 6,
              color: '#1a1a2e',
              fontSize: 12,
              fontWeight: 600,
              padding: '6px 16px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
