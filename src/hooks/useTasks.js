import { useTaskStore } from '../store/taskStore'

export function useTasks() {
  const store = useTaskStore()
  return {
    tasks: store.getFilteredTasks(),
    addTask: store.addTask,
    toggleTask: store.toggleTask,
    updateTaskTitle: store.updateTaskTitle,
    updateTaskPriority: store.updateTaskPriority,
    deleteTask: store.deleteTask,
  }
}
