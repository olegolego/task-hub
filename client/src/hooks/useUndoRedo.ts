import { useState, useCallback } from 'react'

interface UndoAction {
  description: string
  undo: () => void
  redo: () => void
}

export function useUndoRedo() {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoAction[]>([])

  const push = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [...prev.slice(-19), action]) // Keep last 20
    setRedoStack([]) // Clear redo on new action
  }, [])

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      const action = prev[prev.length - 1]!
      action.undo()
      setRedoStack((r) => [...r, action])
      return prev.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev
      const action = prev[prev.length - 1]!
      action.redo()
      setUndoStack((u) => [...u, action])
      return prev.slice(0, -1)
    })
  }, [])

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    lastAction: undoStack[undoStack.length - 1],
  }
}
