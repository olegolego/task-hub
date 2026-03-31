// @ts-nocheck
import { useEffect } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useUIStore } from '../store/uiStore'
import { ipc } from '../utils/ipc'
import { NAV_PANELS } from '../utils/constants'

const PANEL_KEYS = {
  '1': NAV_PANELS.TASKS,
  '2': NAV_PANELS.IDEAS,
  '3': NAV_PANELS.GROUPS,
  '4': NAV_PANELS.PEOPLE,
  '5': NAV_PANELS.MESSAGES,
  '6': NAV_PANELS.FILES,
  '7': NAV_PANELS.CALENDAR,
  '8': NAV_PANELS.LLM,
  '9': NAV_PANELS.ACTIVITY,
}

export function useShortcuts() {
  const focusInput = useTaskStore((s) => s.focusInput)

  useEffect(() => {
    function onKeyDown(e) {
      const isMod = e.ctrlKey || e.metaKey

      // Cmd+N — focus the add input
      if (isMod && e.key === 'n') {
        e.preventDefault()
        focusInput()
        return
      }

      // Cmd+K — toggle search
      if (isMod && e.key === 'k') {
        e.preventDefault()
        useUIStore.getState().toggleSearch()
        return
      }

      // Cmd+, — open settings
      if (isMod && e.key === ',') {
        e.preventDefault()
        useUIStore.getState().toggleSettings()
        return
      }

      // Cmd+1..8 — switch panels
      if (isMod && PANEL_KEYS[e.key]) {
        e.preventDefault()
        useUIStore.getState().setActivePanel(PANEL_KEYS[e.key])
        return
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
