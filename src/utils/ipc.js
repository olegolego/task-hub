// Safe wrappers around window.api (available only in Electron)
const api = () => window.api

export const ipc = {
  getTasks: () => api()?.getTasks() ?? Promise.resolve([]),
  createTask: (data) => api()?.createTask(data) ?? Promise.resolve(null),
  updateTask: (data) => api()?.updateTask(data) ?? Promise.resolve(null),
  deleteTask: (id) => api()?.deleteTask(id) ?? Promise.resolve(),
  reorderTask: (id, order) => api()?.reorderTask(id, order) ?? Promise.resolve(),
  getSettings: () => api()?.getSettings() ?? Promise.resolve({}),
  updateSettings: (data) => api()?.updateSettings(data) ?? Promise.resolve({}),
  minimizeWindow: () => api()?.minimizeWindow(),
  closeWindow: () => api()?.closeWindow(),
  togglePin: () => api()?.togglePin() ?? Promise.resolve(true),
  getPinState: () => api()?.getPinState() ?? Promise.resolve(true),
}
