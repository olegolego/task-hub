import React, { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import TaskInput from './components/TaskInput'
import TaskList from './components/TaskList'
import Sidebar from './components/layout/Sidebar'
import StatusBar from './components/layout/StatusBar'
import IdeasBoard from './components/ideas/IdeasBoard'
import GroupPanel from './components/groups/GroupPanel'
import PeoplePanel from './components/people/PeoplePanel'
import SetupScreen from './components/setup/SetupScreen'
import { useTaskStore } from './store/taskStore'
import { useShortcuts } from './hooks/useShortcuts'
import { initMessageBus } from './network/messageBus'
import { useConnectionStore } from './store/connectionStore'
import { ipc } from './utils/ipc'
import { NAV_PANELS } from './utils/constants'

const PANEL_TITLES = {
  [NAV_PANELS.TASKS]: 'TASKS',
  [NAV_PANELS.IDEAS]: 'IDEAS',
  [NAV_PANELS.GROUPS]: 'GROUPS',
  [NAV_PANELS.PEOPLE]: 'PEOPLE',
}

export default function App() {
  const { loadSettings, theme } = useTaskStore()
  const { setServerUrl, setDisplayName } = useConnectionStore()
  const [activePanel, setActivePanel] = useState(NAV_PANELS.TASKS)
  const [isSetup, setIsSetup] = useState(false)
  const [loading, setLoading] = useState(true)

  useShortcuts()

  useEffect(() => {
    // Check URL params for setup mode (from setup window)
    const params = new URLSearchParams(window.location.search)
    if (params.get('setup') === '1') {
      setIsSetup(true)
      setLoading(false)
      return
    }

    // Initialize message bus
    const cleanup = initMessageBus()

    // Load settings and config
    Promise.all([
      loadSettings(),
      ipc.getConfig(),
    ]).then(([, config]) => {
      if (!config?.serverUrl || !config?.displayName) {
        setIsSetup(true)
      } else {
        setServerUrl(config.serverUrl)
        setDisplayName(config.displayName)
      }
      setLoading(false)
    })

    return cleanup
  }, [])

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text-secondary)', fontSize: 13,
      }}>
        Loading…
      </div>
    )
  }

  if (isSetup) {
    return (
      <div className={`app-container ${theme === 'light' ? 'light' : ''}`}>
        <SetupScreen onComplete={() => setIsSetup(false)} />
      </div>
    )
  }

  return (
    <div className={`app-container ${theme === 'light' ? 'light' : ''}`} style={{ flexDirection: 'column' }}>
      <TitleBar panelTitle={PANEL_TITLES[activePanel]} />

      {/* Body: sidebar + panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

        {/* Panel content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activePanel === NAV_PANELS.TASKS && (
            <>
              <TaskInput />
              <TaskList />
            </>
          )}
          {activePanel === NAV_PANELS.IDEAS && <IdeasBoard />}
          {activePanel === NAV_PANELS.GROUPS && <GroupPanel />}
          {activePanel === NAV_PANELS.PEOPLE && <PeoplePanel />}
        </div>
      </div>

      <StatusBar />
    </div>
  )
}
