import React, { useEffect } from 'react'
import TitleBar from './components/TitleBar'
import TaskInput from './components/TaskInput'
import CategoryTabs from './components/CategoryTabs'
import TaskList from './components/TaskList'
import { useTaskStore } from './store/taskStore'
import { useShortcuts } from './hooks/useShortcuts'

export default function App() {
  const { loadTasks, loadSettings, theme } = useTaskStore()

  useEffect(() => {
    loadSettings()
    loadTasks()
  }, [])

  useShortcuts()

  return (
    <div className={`app-container ${theme === 'light' ? 'light' : ''}`}>
      <TitleBar />
      <TaskInput />
      <CategoryTabs />
      <TaskList />
    </div>
  )
}
