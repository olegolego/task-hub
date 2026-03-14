# TaskHub — Server & App Restart Guide

## Quick restart (most common case)

Run these two commands in order:

```bash
# 1. Kill everything
pkill -9 -f "Electron"; pkill -9 -f "vite"; pkill -9 -f "concurrently"; lsof -i :8765 -t | xargs kill -9 2>/dev/null

# 2. Start fresh
cd ~/Task\ Manager && npm run dev
```

---

## What each command does

| Command | What it kills |
|---|---|
| `pkill -9 -f "Electron"` | Electron app window(s) |
| `pkill -9 -f "vite"` | Vite dev server (frontend) |
| `pkill -9 -f "concurrently"` | The process that coordinates server + client |
| `lsof -i :8765 -t \| xargs kill -9` | The WebSocket server on port 8765 |

---

## Start options

### Full app (server + client together)
```bash
cd ~/Task\ Manager
npm run dev
```
This starts both the server and the Electron window in one terminal.

### Server only (for teammates to connect)
```bash
cd ~/Task\ Manager
npm run server
```
Keep this terminal open. Closing it stops the server and disconnects everyone.

### Check if server is running
```bash
lsof -i :8765
```
If you see a `node` process listed — server is running. If empty — it's stopped.

---

## Where data is stored

All tasks, ideas, groups, and messages are in:
```
~/.taskmanager-server/taskmanager.db
```

**This file is never deleted by restarts.** Your data is safe as long as this file exists.

If you see tasks disappear after a restart, it means the app reconnected before data loaded — just wait 2–3 seconds after the window opens.

---

## Common problems and fixes

### "Offline" after restart
The renderer loaded before the connection was ready. The app now auto-recovers this. If it still shows offline after 5 seconds:
```bash
pkill -9 -f "Electron"; cd ~/Task\ Manager && npm run dev
```

### "Port 8765 already in use"
An old server is still running. Kill it:
```bash
lsof -i :8765 -t | xargs kill -9
```
Then start again.

### Two app windows open at once
Multiple Electron instances cause conflicts. Kill all of them:
```bash
pkill -9 -f "Electron"
```
Then start with `npm run dev`.

### Tasks/ideas not loading after connect
The server sends data 1–2 seconds after connection. If nothing appears after 5 seconds, try switching panels (click Tasks → Ideas → Tasks) to trigger a re-render. If still empty, restart.

### Teammate shows "waiting for approval"
Open the **People panel** (person icon) on your machine — you'll see them listed. Click **Approve**.

### Teammate can't connect at all
- Make sure they're using your local IP, not `localhost` (e.g. `ws://192.168.1.50:8765`)
- Find your IP: `ipconfig getifaddr en0`
- Make sure the server is running: `lsof -i :8765`
- Make sure your firewall allows port 8765

---

## Database backup

To back up all data before a risky change:
```bash
cp ~/.taskmanager-server/taskmanager.db ~/.taskmanager-server/taskmanager.db.bak
```

To restore:
```bash
cp ~/.taskmanager-server/taskmanager.db.bak ~/.taskmanager-server/taskmanager.db
```
