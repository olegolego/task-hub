# TaskHub

Always-on-top collaborative task manager for your local network.
Share tasks, post ideas, and see who's online — no cloud, no accounts.
Connections are secured with Ed25519 keypairs — every message is signed.

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

Your identity key is generated automatically on first launch and saved to `~/.taskmanager/`.
No passwords, no accounts — your key is your identity.

### Approval

When you connect for the first time, your account starts as **pending**.
The admin will see your name in the **People** panel and click **Approve**.
Until then, you'll see a yellow "waiting for approval" banner.

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

The **first user** to connect becomes the admin automatically.
All teammates who connect after that start as pending and need the admin to approve them.

---

## How teammates send you their key (optional / for verification)

TaskHub generates an Ed25519 keypair for each user automatically.
The public key is stored at:

| Platform | Path |
|---|---|
| macOS / Linux | `~/.taskmanager/id_ed25519.pub` |
| Windows | `C:\Users\YourName\.taskmanager\id_ed25519.pub` |

If you want to verify a teammate's identity out-of-band, ask them to send you the contents of that file (one line starting with `AAAA...`). You can compare it against what the server logs when they first connect:

```
[Auth] New user registered: Alice a1b2c3d4e5f6g7h8 (member, pending)
```

The hex fingerprint is a SHA-256 hash of their public key — unique per device.

**They don't need to do anything manually.** The key is generated and used automatically.

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

**"Waiting for admin approval"** → The admin needs to open the People panel and click Approve next to your name.

**App window not visible** → Check your system tray / taskbar and click the TaskHub icon.
