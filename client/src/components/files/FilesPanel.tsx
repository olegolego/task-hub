import React, { useEffect, useRef, useState } from 'react'
import { useFilesStore } from '../../store/filesStore'
import { useConnectionStore } from '../../store/connectionStore'
import { ipc } from '../../utils/ipc'

const MIME_ICON = (mime = '') => {
  if (mime.startsWith('image/')) return '🖼'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return '🗜'
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('text')) return '📝'
  return '📎'
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilesPanel() {
  const {
    files,
    loading,
    loadFiles,
    deleteFile,
    deleteFolder,
    getFolders,
    createFolder,
    renameFile,
  } = useFilesStore()
  const myUserId = useConnectionStore((s) => s.myUserId)
  const myRole = useConnectionStore((s) => s.myRole)
  const [activeFolder, setActiveFolder] = useState('All')
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    loadFiles()
  }, [])

  const folders = ['All', ...getFolders()]
  const visible =
    activeFolder === 'All' ? files : files.filter((f) => (f.folder || 'General') === activeFolder)

  async function handleUpload() {
    setUploading(true)
    try {
      await ipc.uploadCompanyFile(activeFolder === 'All' ? 'General' : activeFolder)
    } finally {
      setUploading(false)
    }
  }

  function handleNewFolder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) return
    createFolder(name)
    setNewFolderName('')
    setShowNewFolder(false)
  }

  async function handleDownload(file: any) {
    setDownloadingId(file.id)
    try {
      await ipc.downloadCompanyFile({ fileId: file.id, fileName: file.name })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 10px',
          background: 'var(--surface)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            flex: 1,
          }}
        >
          Company Files
        </span>
        <button
          onClick={() => {
            setShowNewFolder((s) => !s)
            setNewFolderName('')
          }}
          style={{
            background: 'var(--hover)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            cursor: 'pointer',
          }}
        >
          + Folder
        </button>
        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 4,
            color: '#1a1a2e',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            cursor: uploading ? 'default' : 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
      </div>

      {/* New folder inline form */}
      {showNewFolder && (
        <form
          onSubmit={handleNewFolder}
          style={{
            padding: '6px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 6,
          }}
        >
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name…"
            autoFocus
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 12,
              padding: '3px 8px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 4,
              color: '#1a1a2e',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewFolder(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 11,
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Folder tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          overflowX: 'auto',
          flexShrink: 0,
          alignItems: 'center',
        }}
      >
        {folders.map((folder) => {
          const isDeletable = folder !== 'All' && folder !== 'General' && myRole === 'admin'
          const isActive = activeFolder === folder
          return (
            <div
              key={folder}
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
              <button
                onClick={() => setActiveFolder(folder)}
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--hover)',
                  border: 'none',
                  borderRadius: 4,
                  color: isActive ? '#1a1a2e' : 'var(--text-secondary)',
                  fontSize: 11,
                  padding: isDeletable ? '3px 22px 3px 8px' : '3px 8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {folder}
              </button>
              {isDeletable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (
                      window.confirm(
                        `Delete folder "${folder}"? Files inside will be moved to General.`,
                      )
                    ) {
                      deleteFolder(folder)
                      if (activeFolder === folder) setActiveFolder('All')
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: 3,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: isActive ? '#1a1a2e' : '#ef476f',
                    fontSize: 10,
                    padding: 0,
                    lineHeight: 1,
                    opacity: 0.7,
                  }}
                  title="Delete folder"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {loading && (
          <div
            style={{
              color: 'var(--text-secondary)',
              fontSize: 12,
              textAlign: 'center',
              padding: 24,
            }}
          >
            Loading…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: 32,
              color: 'var(--text-secondary)',
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ opacity: 0.4 }}
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 12, opacity: 0.6, textAlign: 'center' }}>
              No files yet.
              <br />
              Upload one above.
            </span>
          </div>
        )}
        {visible.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            myUserId={myUserId}
            myRole={myRole}
            downloading={downloadingId === file.id}
            onDownload={() => handleDownload(file)}
            onDelete={() => deleteFile(file.id)}
            onRename={(name) => renameFile(file.id, name)}
          />
        ))}
      </div>

      {/* LLM integration hint */}
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--surface)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ color: 'var(--accent)', flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Files stored at{' '}
          <code
            style={{
              fontSize: 9,
              background: 'rgba(255,255,255,0.06)',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            ~/.taskmanager-server/company-files/
          </code>{' '}
          — ready for local LLM indexing
        </span>
      </div>
    </div>
  )
}

interface FileRowProps {
  file: any
  myUserId: string
  myRole: string
  downloading: boolean
  onDownload: () => void
  onDelete: () => void
  onRename: (name: string) => void
}

function FileRow({
  file,
  myUserId,
  myRole,
  downloading,
  onDownload,
  onDelete,
  onRename,
}: FileRowProps) {
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const editRef = useRef<HTMLInputElement>(null)
  const canDelete = file.uploadedBy === myUserId || myRole === 'admin'

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditName(file.name)
    setEditing(true)
    setTimeout(() => {
      editRef.current?.select()
    }, 0)
  }

  function commitEdit() {
    const n = editName.trim()
    if (n && n !== file.name) onRename(n)
    setEditing(false)
  }

  function handleEditKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    }
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        if (editing) commitEdit()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px',
        background: hovered ? 'var(--hover)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{MIME_ICON(file.mimeType)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={editRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKey}
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              fontSize: 12,
              padding: '1px 4px',
              outline: 'none',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          />
        ) : (
          <div
            onDoubleClick={startEdit}
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}
            title="Double-click to rename"
          >
            {file.name}
          </div>
        )}
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-secondary)',
            display: 'flex',
            gap: 8,
            marginTop: 1,
          }}
        >
          <span>{formatBytes(file.size)}</span>
          <span>{file.folder || 'General'}</span>
          <span>{file.uploaderName}</span>
          <span>{new Date(file.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          opacity: hovered && !editing ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      >
        <button
          onClick={startEdit}
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            cursor: 'pointer',
          }}
          title="Rename"
        >
          ✎
        </button>
        <button
          onClick={onDownload}
          disabled={downloading}
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            color: 'var(--accent)',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            cursor: downloading ? 'default' : 'pointer',
          }}
        >
          {downloading ? '…' : '↓'}
        </button>
        {canDelete && (
          <button
            onClick={() => {
              if (window.confirm(`Delete "${file.name}"?`)) onDelete()
            }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239,71,111,0.3)',
              borderRadius: 4,
              color: '#ef476f',
              fontSize: 10,
              padding: '2px 6px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
