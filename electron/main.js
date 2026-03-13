const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, shell } = require('electron')
const path = require('path')
const db = require('./db')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let tray = null
let isPinned = true

// Default settings
const DEFAULT_SETTINGS = {
  theme: 'dark',
  windowBounds: { x: null, y: null, width: 350, height: 520 },
  showCompleted: true,
  activeCategory: 'all',
}

function getSettings() {
  const stored = db.getAllSettings()
  return { ...DEFAULT_SETTINGS, ...stored }
}

function createWindow() {
  const settings = getSettings()
  const bounds = settings.windowBounds || DEFAULT_SETTINGS.windowBounds

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x ?? undefined,
    y: bounds.y ?? undefined,
    minWidth: 250,
    maxWidth: 600,
    minHeight: 300,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    title: 'Task Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'floating')

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    const b = mainWindow.getBounds()
    db.setSetting('windowBounds', b)
    mainWindow.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  // Use a simple template image or fallback
  const iconPath = path.join(__dirname, '../assets/tray-icon.png')
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) icon = nativeImage.createEmpty()
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Task Manager')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => toggleWindowVisibility(),
    },
    {
      label: 'Quick Add Task',
      click: () => {
        showWindow()
        mainWindow?.webContents.send('focus-input')
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => toggleWindowVisibility())
}

function showWindow() {
  if (!mainWindow) createWindow()
  mainWindow.show()
  mainWindow.focus()
}

function toggleWindowVisibility() {
  if (!mainWindow) return createWindow()
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    showWindow()
  }
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  globalShortcut.register('CommandOrControl+Shift+T', () => {
    toggleWindowVisibility()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Keep app running in tray on all platforms
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
  else showWindow()
})

// ── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('tasks:get-all', () => db.getAllTasks())
ipcMain.handle('tasks:create', (_, data) => db.createTask(data))
ipcMain.handle('tasks:update', (_, data) => db.updateTask(data))
ipcMain.handle('tasks:delete', (_, data) => db.deleteTask(data))
ipcMain.handle('tasks:reorder', (_, data) => db.reorderTask(data))

ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('settings:update', (_, data) => {
  Object.entries(data).forEach(([k, v]) => db.setSetting(k, v))
  return getSettings()
})

ipcMain.handle('window:minimize', () => mainWindow?.hide())
ipcMain.handle('window:close', () => {
  const b = mainWindow?.getBounds()
  if (b) db.setSetting('windowBounds', b)
  mainWindow?.hide()
})
ipcMain.handle('window:toggle-pin', () => {
  isPinned = !isPinned
  mainWindow?.setAlwaysOnTop(isPinned, 'floating')
  return isPinned
})
ipcMain.handle('window:get-pin', () => isPinned)
