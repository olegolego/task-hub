import { useEffect } from 'react'
import { useTaskStore } from '../store/taskStore'

export function useShortcuts() {
  const { focusInput } = useTaskStore()

  useEffect(() => {
    function onKeyDown(e) {
      // Ctrl/Cmd+N — focus the add input
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        focusInput()
      }
    }

    // Listen for focus-input from tray menu
    if (window.api) {
      // Electron sends this via webContents.send
      const { ipcRenderer } = window.__electronIpc ?? {}
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusInput])
}
