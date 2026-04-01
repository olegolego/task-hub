import { useEffect } from 'react'
import { useTaskStore } from '../store/taskStore'
import { ipc } from '../utils/ipc'

export function useShortcuts() {
  const { focusInput } = useTaskStore()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd+N — focus the add input
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        focusInput()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    // Listen for focus-input from tray menu
    const cleanup = ipc.onFocusInput(() => focusInput())

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (typeof cleanup === 'function') cleanup()
    }
  }, [focusInput])
}
