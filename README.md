# TaskHub

Always-on-top collaborative task manager for your local network.
Share tasks, post ideas, and see who's online — no cloud, no accounts.

---

## Requirements (install once)

- **Node.js LTS** — download from https://nodejs.org
  After installing, restart your terminal and verify: `node --version`

- **Git** — download from https://git-scm.com (Windows users may not have it)

---

## Join as a team member (client only)

```bash
git clone https://github.com/olegolego/task-hub.git
cd task-hub/client
npm install
npm run dev
```

On the setup screen:
- **Display name** — your name
- **Server URL** — the address your team admin gave you (e.g. `ws://10.10.10.132:8765`)

Your identity key is generated automatically on first launch. No manual setup needed.

---

## Run the server (admin / one machine only)

The server only needs to run on one machine on the network.

```bash
cd task-hub/server
npm install
node src/index.js
```

The server listens on port **8765**. Share your local IP with teammates:
- **macOS/Linux:** `ipconfig getifaddr en0`
- **Windows:** `ipconfig` → look for IPv4 Address

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Shift + T` | Show / hide window |
| `Cmd/Ctrl + N` | Focus task input |
| `!urgent` `!high` `!med` `!low` | Set priority inline when typing a task |

---

## Troubleshooting

**"npm is not recognized"** → Install Node.js from https://nodejs.org, then restart your terminal.

**"Cannot connect to server"** → Make sure the server machine is running `node src/index.js` and you're on the same network.

**App window not visible** → Check your system tray / taskbar and click the TaskHub icon.
