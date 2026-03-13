# CLAUDE.md — Collaborative Company Task & Ideas Manager

## What This Is

A **collaborative, always-on-top task and ideas manager** for a company's local network. People share tasks, post ideas to a shared "ideas board," assign work to groups, and stay connected — all without cloud services. Every machine on the company network can participate.

The app runs as a **desktop widget** (always-on-top) on each person's machine, connected to a central server on the local network.

---

## Architecture Philosophy

**Design for extension.** Every architectural decision optimizes for one thing: making it easy to add new features later by prompting Claude. That means:

- Clean separation between layers (network, data, business logic, UI)
- Every feature is a self-contained module
- The protocol between client and server is message-based and extensible
- New feature = new message types + new UI component — nothing else changes

---

## Network Architecture

### How Machines Connect

```
 ┌─────────────────────────────────────────────────────────┐
 │                  COMPANY LOCAL NETWORK                   │
 │                                                          │
 │   ┌──────────┐     WebSocket (wss://)     ┌──────────┐  │
 │   │ Desktop  │◄──────────────────────────►│  Central  │  │
 │   │ Client A │       (persistent)         │  Server   │  │
 │   └──────────┘                            │           │  │
 │                                           │  ┌─────┐  │  │
 │   ┌──────────┐     WebSocket (wss://)     │  │SQLite│  │  │
 │   │ Desktop  │◄──────────────────────────►│  │  DB  │  │  │
 │   │ Client B │       (persistent)         │  └─────┘  │  │
 │   └──────────┘                            │           │  │
 │                                           │  ┌─────┐  │  │
 │   ┌──────────┐     WebSocket (wss://)     │  │Auth  │  │  │
 │   │ Desktop  │◄──────────────────────────►│  │Keys  │  │  │
 │   │ Client C │       (persistent)         │  └─────┘  │  │
 │   └──────────┘                            └──────────┘  │
 │                                                          │
 └─────────────────────────────────────────────────────────┘
```

### Why NOT raw SSH / Why WebSockets

You mentioned SSH keys — great instinct for authentication, but SSH as a transport protocol is wrong for this use case. Here's the approach:

- **Authentication**: Use **SSH-style key pairs** (Ed25519). Each user generates a keypair. The public key is registered with the server. Every message is signed. No passwords, no tokens expiring, no login screens.
- **Transport**: Use **WebSockets over TLS** on the local network. This gives us persistent bidirectional connections — the server can push updates to all clients instantly (new task assigned, new idea posted, someone completed a task).

**SSH keys for identity, WebSockets for communication.**

### Authentication Flow (SSH Key-Based)

```
FIRST TIME SETUP (once per user):
1. User launches app for the first time
2. App generates Ed25519 keypair → saves private key locally (~/.taskmanager/id_ed25519)
3. App prompts for: display name, team/group
4. App sends public key + user info to server via a registration endpoint
5. Admin approves the registration (or auto-approve on trusted networks)
6. User is now authenticated — all future messages are signed with their private key

EVERY CONNECTION AFTER:
1. Client connects to server via WebSocket
2. Server sends a challenge (random nonce)
3. Client signs the nonce with their private key, sends back signature + public key fingerprint
4. Server verifies signature against registered public keys
5. Connection authenticated — no password ever transmitted
```

### Network Discovery

Clients need to find the server on the local network. Options (implement in order of simplicity):

1. **Manual config** (Phase 1): User enters server IP:port on first launch. Store in config.
2. **mDNS/Bonjour** (Phase 2): Server broadcasts `_taskmanager._tcp.local`. Clients auto-discover. Use `bonjour-service` npm package.
3. **DNS-SD** (Phase 3): For larger networks with proper DNS infrastructure.

---

## Software Architecture

### Layered Module System

The entire codebase — both server and client — follows a **modular plugin architecture**. Each feature is a module that registers itself. Adding a feature never requires changing existing code.

```
┌─────────────────────────────────────────────────────┐
│                    UI LAYER (React)                  │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌───────────┐  │
│  │TaskPanel│ │IdeasBoard│ │Groups │ │ [Future]  │  │
│  └────┬────┘ └────┬─────┘ └───┬───┘ └─────┬─────┘  │
│───────┼───────────┼───────────┼───────────┼─────────│
│              STATE LAYER (Zustand stores)            │
│  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌───────────┐  │
│  │taskStore│ │ideaStore │ │group  │ │ [Future]  │  │
│  │         │ │          │ │Store  │ │           │  │
│  └────┬────┘ └────┬─────┘ └───┬───┘ └─────┬─────┘  │
│───────┼───────────┼───────────┼───────────┼─────────│
│              MESSAGE LAYER (Protocol)                │
│  ┌──────────────────────────────────────────────┐   │
│  │  MessageBus — routes messages by type         │   │
│  │  send(type, payload) / on(type, handler)      │   │
│  └──────────────────┬───────────────────────────┘   │
│─────────────────────┼───────────────────────────────│
│              NETWORK LAYER (WebSocket)               │
│  ┌──────────────────┴───────────────────────────┐   │
│  │  ConnectionManager — reconnect, queue, auth   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### The Message Protocol (Most Important Design Decision)

Everything in the system is a **message**. Tasks, ideas, votes, comments, status updates — all messages. This is what makes the system extensible.

```typescript
// Every message follows this shape
interface Message {
  id: string;              // UUID
  type: string;            // e.g., "task:create", "idea:post", "idea:vote"
  payload: any;            // Type-specific data
  author: string;          // Public key fingerprint of sender
  timestamp: string;       // ISO 8601
  scope: Scope;            // Who can see this message
  signature: string;       // Ed25519 signature of (id + type + payload + timestamp)
}

interface Scope {
  type: 'global' | 'group' | 'direct';
  target?: string;         // Group ID or user fingerprint
}
```

**Adding a new feature** = defining new message types:

```
Existing:
  task:create, task:update, task:complete, task:delete, task:assign
  idea:post, idea:vote, idea:comment
  group:create, group:join, group:leave
  user:status, user:typing

Future (just add new types — nothing else changes):
  file:share, file:request
  poll:create, poll:vote
  standup:post, standup:summary
  milestone:create, milestone:complete
  chat:message, chat:react
```

The server routes messages by scope. The client's MessageBus routes by type to the right store/handler. New feature = new type + new handler. Old code untouched.

---

## Project Structure

```
task-manager/
├── CLAUDE.md
│
├── server/                          # Central server (runs on one machine)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts                 # Entry point — start server
│   │   ├── server.ts                # WebSocket server setup
│   │   ├── auth/
│   │   │   ├── keyManager.ts        # Register/verify public keys
│   │   │   ├── challenge.ts         # Challenge-response auth flow
│   │   │   └── permissions.ts       # Role-based access (admin, member, viewer)
│   │   ├── db/
│   │   │   ├── database.ts          # SQLite connection + migrations
│   │   │   ├── migrations/          # Versioned schema migrations
│   │   │   │   ├── 001_init.sql
│   │   │   │   ├── 002_ideas.sql
│   │   │   │   └── 003_groups.sql
│   │   │   └── queries/             # Prepared query modules
│   │   │       ├── tasks.ts
│   │   │       ├── ideas.ts
│   │   │       ├── groups.ts
│   │   │       └── users.ts
│   │   ├── modules/                 # Feature modules (one per feature)
│   │   │   ├── tasks.module.ts      # Handles task:* messages
│   │   │   ├── ideas.module.ts      # Handles idea:* messages
│   │   │   ├── groups.module.ts     # Handles group:* messages
│   │   │   ├── presence.module.ts   # Handles user:* messages (online/offline)
│   │   │   └── moduleRegistry.ts    # Auto-discovers and loads modules
│   │   ├── broadcast/
│   │   │   └── router.ts            # Routes messages by scope to correct clients
│   │   └── utils/
│   │       ├── crypto.ts            # Ed25519 sign/verify helpers
│   │       └── logger.ts
│   └── tsconfig.json
│
├── client/                          # Electron desktop app (runs on every machine)
│   ├── package.json
│   ├── electron/
│   │   ├── main.ts                  # Electron main process
│   │   ├── preload.ts               # IPC bridge
│   │   ├── tray.ts                  # System tray logic
│   │   └── localDb.ts              # Local SQLite cache (offline support)
│   ├── src/
│   │   ├── App.tsx                  # Root — layout + routing between panels
│   │   ├── main.tsx                 # React entry
│   │   │
│   │   ├── network/                 # Network layer
│   │   │   ├── connection.ts        # WebSocket connect/reconnect/auth
│   │   │   ├── messageBus.ts        # Central message dispatcher
│   │   │   ├── crypto.ts            # Client-side key management + signing
│   │   │   └── offlineQueue.ts      # Queue messages when disconnected
│   │   │
│   │   ├── stores/                  # Zustand stores (one per feature)
│   │   │   ├── taskStore.ts
│   │   │   ├── ideaStore.ts
│   │   │   ├── groupStore.ts
│   │   │   ├── userStore.ts         # Current user + presence of others
│   │   │   └── settingsStore.ts
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── TitleBar.tsx     # Draggable, always-on-top controls
│   │   │   │   ├── Sidebar.tsx      # Navigation: Tasks, Ideas, Groups, People
│   │   │   │   └── StatusBar.tsx    # Connection status, online users count
│   │   │   │
│   │   │   ├── tasks/               # Task management feature
│   │   │   │   ├── TaskPanel.tsx    # Main task view
│   │   │   │   ├── TaskList.tsx
│   │   │   │   ├── TaskItem.tsx
│   │   │   │   ├── TaskInput.tsx    # Quick-add with assign + group scope
│   │   │   │   └── TaskFilters.tsx
│   │   │   │
│   │   │   ├── ideas/               # Ideas board feature
│   │   │   │   ├── IdeasBoard.tsx   # Card-based idea wall
│   │   │   │   ├── IdeaCard.tsx     # Single idea: title, author, votes, comments
│   │   │   │   ├── IdeaComposer.tsx # Post a new idea
│   │   │   │   └── IdeaThread.tsx   # Expanded view with comments
│   │   │   │
│   │   │   ├── groups/              # Group management
│   │   │   │   ├── GroupPanel.tsx
│   │   │   │   ├── GroupList.tsx
│   │   │   │   └── GroupMembers.tsx
│   │   │   │
│   │   │   ├── people/              # Online presence + user directory
│   │   │   │   ├── PeoplePanel.tsx
│   │   │   │   └── UserAvatar.tsx
│   │   │   │
│   │   │   └── shared/              # Reusable UI components
│   │   │       ├── Badge.tsx
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Tooltip.tsx
│   │   │       └── PresenceIndicator.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useConnection.ts     # Connection state + reconnect
│   │   │   ├── useMessages.ts       # Subscribe to message types
│   │   │   ├── usePresence.ts       # Who's online
│   │   │   └── useKeyboard.ts       # Keyboard shortcut handler
│   │   │
│   │   └── styles/
│   │       └── index.css
│   │
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── electron-builder.yml
│
├── shared/                          # Code shared between server and client
│   ├── package.json
│   ├── types/
│   │   ├── messages.ts              # Message type definitions
│   │   ├── models.ts                # Task, Idea, Group, User type definitions
│   │   └── protocol.ts             # Protocol constants
│   └── utils/
│       ├── crypto.ts                # Ed25519 helpers (used by both sides)
│       └── validation.ts            # Message validation schemas (Zod)
│
├── scripts/
│   ├── setup-server.sh              # Install deps, init DB, generate server keys
│   ├── setup-client.sh              # Install deps, generate user keypair
│   ├── generate-keypair.ts          # Standalone keypair generator
│   └── approve-user.ts              # Admin tool: approve a pending user registration
│
└── docker-compose.yml               # Optional: run server in Docker
```

---

## Database Schema

### Server Database (SQLite — `server/data/taskmanager.db`)

```sql
-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
  id              TEXT PRIMARY KEY,          -- Public key fingerprint (SHA-256 of pubkey)
  public_key      TEXT NOT NULL UNIQUE,      -- Ed25519 public key (base64)
  display_name    TEXT NOT NULL,
  email           TEXT,
  role            TEXT DEFAULT 'member' CHECK(role IN ('admin','member','viewer')),
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','disabled')),
  avatar_color    TEXT,                      -- Auto-assigned color for avatar
  created_at      TEXT DEFAULT (datetime('now')),
  last_seen_at    TEXT
);

-- ============================================================
-- GROUPS
-- ============================================================

CREATE TABLE groups (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  created_by      TEXT REFERENCES users(id),
  color           TEXT,                      -- Group accent color
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE group_members (
  group_id        TEXT REFERENCES groups(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'member' CHECK(role IN ('admin','member')),
  joined_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  completed       INTEGER DEFAULT 0,
  priority        TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
  status          TEXT DEFAULT 'todo' CHECK(status IN ('todo','in_progress','review','done')),
  created_by      TEXT REFERENCES users(id),
  assigned_to     TEXT REFERENCES users(id),  -- NULL = unassigned
  group_id        TEXT REFERENCES groups(id),  -- NULL = personal task
  due_date        TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_tasks_group ON tasks(group_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

-- ============================================================
-- IDEAS BOARD
-- ============================================================

CREATE TABLE ideas (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  body            TEXT,                       -- Longer description / details
  created_by      TEXT REFERENCES users(id),
  group_id        TEXT REFERENCES groups(id),  -- NULL = visible to everyone
  category        TEXT DEFAULT 'general',      -- User-defined categories
  status          TEXT DEFAULT 'open' CHECK(status IN ('open','discussed','accepted','archived')),
  pinned          INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE idea_votes (
  idea_id         TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  vote            INTEGER DEFAULT 1 CHECK(vote IN (-1, 1)),  -- upvote or downvote
  created_at      TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (idea_id, user_id)
);

CREATE TABLE idea_comments (
  id              TEXT PRIMARY KEY,
  idea_id         TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id),
  body            TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_ideas_group ON ideas(group_id);

-- ============================================================
-- ACTIVITY LOG (for notifications and history)
-- ============================================================

CREATE TABLE activity_log (
  id              TEXT PRIMARY KEY,
  message_type    TEXT NOT NULL,              -- e.g., 'task:create', 'idea:vote'
  actor_id        TEXT REFERENCES users(id),
  target_type     TEXT,                       -- 'task', 'idea', 'group'
  target_id       TEXT,
  summary         TEXT,                       -- Human-readable summary
  group_id        TEXT REFERENCES groups(id),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_activity_group ON activity_log(group_id);
CREATE INDEX idx_activity_time ON activity_log(created_at);
```

### Client Local Database (SQLite — `~/.taskmanager/local.db`)

The client keeps a local cache so the app works offline and loads instantly:

```sql
-- Mirror of server tables, synced via messages
-- Same schema as above, plus:

CREATE TABLE sync_state (
  table_name      TEXT PRIMARY KEY,
  last_sync_at    TEXT,                      -- Last successful sync timestamp
  last_message_id TEXT                       -- Last processed message ID
);

CREATE TABLE outbox (
  id              TEXT PRIMARY KEY,
  message_json    TEXT NOT NULL,             -- Full message JSON, queued for sending
  created_at      TEXT DEFAULT (datetime('now')),
  sent            INTEGER DEFAULT 0
);
```

---

## Key Subsystem Designs

### 1. Connection Manager (Client)

```typescript
// client/src/network/connection.ts

class ConnectionManager {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;             // Starts at 1s
  private maxReconnectDelay = 30000;         // Caps at 30s
  private messageQueue: Message[] = [];       // Queued while disconnected
  private messageBus: MessageBus;

  connect(serverUrl: string): void {
    // 1. Open WebSocket to wss://<serverUrl>
    // 2. On open → run auth handshake (challenge-response with Ed25519 key)
    // 3. On authenticated → flush messageQueue
    // 4. On message → route through messageBus
    // 5. On close → exponential backoff reconnect
    // 6. On error → log, trigger reconnect
  }

  send(message: Message): void {
    // Sign message with private key
    // If connected → send immediately
    // If disconnected → add to messageQueue (persisted in local outbox table)
  }
}
```

### 2. Message Bus (Client)

```typescript
// client/src/network/messageBus.ts

class MessageBus {
  private handlers: Map<string, Set<(msg: Message) => void>> = new Map();

  // Subscribe to a message type (or pattern like "task:*")
  on(typePattern: string, handler: (msg: Message) => void): () => void;

  // Dispatch incoming message to all matching handlers
  dispatch(message: Message): void;

  // Send outgoing message through ConnectionManager
  send(type: string, payload: any, scope: Scope): void;
}

// Usage in a store:
// messageBus.on('task:*', (msg) => { ... update task store ... })
// messageBus.on('idea:*', (msg) => { ... update idea store ... })
```

### 3. Server Module System

```typescript
// server/src/modules/moduleRegistry.ts

interface ServerModule {
  name: string;
  messageTypes: string[];                    // Which message types this module handles
  init(db: Database): void;                  // Run on server start (create tables, etc.)
  handle(message: Message, context: MessageContext): Promise<void>;
}

// server/src/modules/tasks.module.ts
const tasksModule: ServerModule = {
  name: 'tasks',
  messageTypes: ['task:create', 'task:update', 'task:complete', 'task:delete', 'task:assign'],

  init(db) {
    // Run migrations for tasks table
  },

  async handle(message, context) {
    switch (message.type) {
      case 'task:create':
        // 1. Validate payload
        // 2. Insert into DB
        // 3. Broadcast to group members (via context.broadcast)
        break;
      // ... other task message types
    }
  }
};
```

**To add a new feature**, create a new module file following this pattern. The registry auto-discovers modules in the `modules/` directory. Zero changes to existing code.

### 4. Ideas Board ("Ideas in the Air")

The ideas board is the collaborative brainstorming space. Design:

- **Post an idea**: Anyone posts a short idea (title + optional body) to a group or globally
- **Vote**: Upvote/downvote ideas. Top-voted ideas float to the top.
- **Comment**: Threaded comments on each idea
- **Status flow**: `open` → `discussed` → `accepted` (becomes a task) → `archived`
- **Convert to task**: One-click to turn an accepted idea into a task assigned to someone
- **Pin**: Admins can pin important ideas to the top

---

## Feature Phases

### Phase 1 — Core Network + Tasks (Build First)

1. **Server setup** — WebSocket server, SQLite database, module registry
2. **Auth system** — Ed25519 keypair generation, challenge-response authentication
3. **User registration** — Generate keys on first launch, register with server
4. **Task CRUD** — Create, update, complete, delete tasks over the network
5. **Group basics** — Create groups, join groups, scope tasks to groups
6. **Client app** — Always-on-top Electron window, task list, quick-add, real-time sync
7. **Presence** — See who's online (green dot on avatars)

### Phase 2 — Ideas Board + Polish

8. **Ideas board** — Post, vote, comment, status transitions
9. **Idea → Task conversion** — One-click promote idea to task
10. **Notifications** — Desktop notifications for: assigned to you, new idea in your group, someone commented on your idea
11. **Offline mode** — Local cache + outbox queue, sync on reconnect
12. **Keyboard shortcuts** — Global toggle, quick-add, navigate between panels
13. **Theming** — Dark/light, accent colors, compact mode

### Phase 3 — Power Features

14. **Activity feed** — Timeline of all actions in your groups
15. **Search** — Full-text search across tasks and ideas
16. **Task statuses** — Kanban-style columns (Todo, In Progress, Review, Done)
17. **Due dates & reminders** — With desktop notifications
18. **mDNS discovery** — Auto-find server on network
19. **File attachments** — Attach files to tasks/ideas (stored on server filesystem)

### Phase 4 — Advanced

20. **Recurring tasks**
21. **Subtasks / checklists**
22. **Polls** — Quick team votes
23. **Standup summaries** — "What did you do yesterday / today / blockers"
24. **Analytics dashboard** — Task completion rates, idea velocity, team activity
25. **Multiple workspaces** — Support multiple companies/teams on one server
26. **Chat/quick messages** — Lightweight messaging (not trying to be Slack, just quick pings)

---

## Design Guidelines

### Window Layout (Compact Mode — 380px wide)

```
┌──────────────────────────────────┐
│ ◉ TaskHub    ● 5 online   ─ □ × │  ← Title bar (draggable)
├──┬───────────────────────────────┤
│  │  ┌─────────────────────────┐  │
│ T│  │ + Add task...       ▼G  │  │  ← Quick-add (▼G = group selector)
│ a│  └─────────────────────────┘  │
│ s│  ┌─ My Tasks ──────────────┐  │
│ k│  │ ☐ Design the login flow │  │
│ s│  │ ☐ Review PR #42     !H  │  │  ← !H = high priority
│  │  │ ☑ Set up CI pipeline    │  │  ← Completed (dimmed)
│──│  └─────────────────────────┘  │
│ 💡│  ┌─ Team Ideas ───────────┐  │
│ I│  │ ▲12 "API rate limiter"  │  │  ← 12 upvotes
│ d│  │ ▲ 8 "Dark mode support" │  │
│ e│  │ ▲ 3 "Weekly retros"     │  │
│ a│  └─────────────────────────┘  │
│ s│                                │
│──│                                │
│ 👥│                                │  ← Sidebar navigation
│  │                                │
├──┴───────────────────────────────┤
│ ● Connected · Engineering Team   │  ← Status bar
└──────────────────────────────────┘
```

### Color Palette & Theming

Use CSS variables for all colors. Support dark/light themes.

```css
/* Dark Theme (default) */
--bg-primary:          #1a1a2e;
--bg-surface:          #22223b;
--bg-surface-hover:    #2a2a4a;
--text-primary:        #edf2f4;
--text-secondary:      #8d99ae;
--accent:              #4cc9f0;
--priority-high:       #ef476f;
--priority-medium:     #ffd166;
--priority-low:        #06d6a0;
--completed:           #4a4e69;

/* Presence / collaboration colors */
--color-online:        #06d6a0;
--color-away:          #ffd166;
--color-offline:       #6c757d;

/* Idea votes */
--color-upvote:        #4cc9f0;
--color-downvote:      #ef476f;

/* Group colors — auto-assigned, 8-color rotation */
--group-1: #4361ee;  --group-2: #f72585;
--group-3: #4cc9f0;  --group-4: #06d6a0;
--group-5: #ffd166;  --group-6: #ef476f;
--group-7: #7209b7;  --group-8: #3a86a7;

/* Light Theme */
--bg-primary:          #f8f9fa;
--bg-surface:          #ffffff;
--bg-surface-hover:    #e9ecef;
--text-primary:        #212529;
--text-secondary:      #6c757d;
--accent:              #4361ee;
```

### Typography

- **Display / Headers**: `"DM Sans"` or `"Satoshi"` — geometric, modern
- **Body / Task text**: `"IBM Plex Sans"` or `"Geist"` — clean, legible at small sizes
- **Monospace** (for IDs, technical): `"JetBrains Mono"`

### Animations

- **New idea appears**: Card slides up with scale(0.95→1) + opacity fade (200ms)
- **Vote count changes**: Number does a quick scale-bounce (150ms)
- **User comes online**: Green dot pulses once (300ms)
- **Task assigned to you**: Brief highlight glow (400ms)
- All animations under 250ms — this is a productivity tool

---

## Security Model

### Key Management

```
~/.taskmanager/
├── id_ed25519           # Private key (chmod 600 — owner read/write only)
├── id_ed25519.pub       # Public key
├── known_server         # Server's public key (trust-on-first-use, like SSH)
├── config.json          # Server URL, user preferences
└── local.db             # Local SQLite cache
```

### Permissions

| Role    | Tasks                         | Ideas                    | Groups                | Admin           |
|---------|-------------------------------|--------------------------|-----------------------|-----------------|
| Admin   | Full CRUD on all              | Full CRUD + pin          | Create, delete, manage| Approve users   |
| Member  | CRUD own + assigned tasks     | Post, vote, comment      | Join, leave           | —               |
| Viewer  | Read only                     | Vote and comment only    | View only             | —               |

### Message Signing

Every message is signed. The server verifies every signature before processing.

```typescript
// Signing (client-side)
const messageBody = JSON.stringify({ id, type, payload, timestamp });
const signature = ed25519.sign(messageBody, privateKey);

// Verification (server-side)
const isValid = ed25519.verify(messageBody, signature, registeredPublicKey);
if (!isValid) reject();
```

---

## Tech Stack Summary

| Component         | Technology                        | Notes                                       |
|-------------------|-----------------------------------|---------------------------------------------|
| Server runtime    | Node.js + TypeScript              | Event-driven, great for WebSocket           |
| Server WebSocket  | `ws` (npm)                        | Fast, battle-tested                         |
| Server DB         | better-sqlite3                    | Synchronous, embedded, no overhead          |
| Server auth       | `tweetnacl` or `@noble/ed25519`   | Ed25519 key gen + sign/verify               |
| Client shell      | Electron                          | Always-on-top, tray, notifications          |
| Client UI         | React + Vite + Tailwind           | Fast dev, utility styling                   |
| Client state      | Zustand                           | One store per feature module                |
| Client crypto     | Same as server (`tweetnacl`)      | Keypair lives client-side                   |
| Shared validation | Zod                               | Validate message payloads both sides        |
| Build             | electron-builder                  | Package for macOS/Windows/Linux             |
| Monorepo          | npm workspaces                    | Share types between server/client           |

---

## Development Workflow for Claude Prompting

When building this incrementally with Claude, follow this order. Each step is a self-contained prompt:

### Server-side prompts (do these first)

```
1. "Set up the monorepo with npm workspaces: server/, client/, shared/. 
    Create package.json files and TypeScript configs."

2. "Build the shared types: Message, Scope, Task, Idea, Group, User 
    interfaces in shared/types/. Add Zod validation schemas."

3. "Build the server WebSocket foundation: ws server, connection tracking, 
    module registry that auto-loads modules from the modules/ directory."

4. "Implement Ed25519 auth: keypair generation script, challenge-response 
    handshake on WebSocket connect, user registration flow."

5. "Build the tasks server module: handle task:create, task:update, 
    task:complete, task:delete, task:assign. Store in SQLite, broadcast 
    to group members."

6. "Build the ideas server module: handle idea:post, idea:vote, 
    idea:comment. Store in SQLite, broadcast to relevant scope."

7. "Build the groups server module: handle group:create, group:join, 
    group:leave. Manage membership."

8. "Add presence tracking: track connected users, broadcast user:online 
    and user:offline events."
```

### Client-side prompts

```
9.  "Set up the Electron client: always-on-top frameless window, custom 
     title bar, system tray, Vite + React + Tailwind."

10. "Build the ConnectionManager: WebSocket connect to server, 
     challenge-response auth using local Ed25519 key, auto-reconnect 
     with exponential backoff."

11. "Build the MessageBus: subscribe to message types with pattern 
     matching (e.g., 'task:*'), dispatch incoming messages to handlers."

12. "Build the task panel UI: TaskList, TaskItem, TaskInput components. 
     Wire to taskStore via MessageBus. Real-time sync with server."

13. "Build the ideas board UI: IdeasBoard with IdeaCard grid, 
     IdeaComposer for posting, voting buttons, comment threads."

14. "Build the group panel: create/join groups, member list, 
     group-scoped views for tasks and ideas."

15. "Build the people panel: online/offline user directory, 
     presence indicators."

16. "Add offline support: local SQLite cache, outbox queue for 
     unsent messages, sync on reconnect."

17. "Add desktop notifications: task assigned to you, new idea 
     in your group, someone replied to your idea."

18. "Polish: keyboard shortcuts, theming (dark/light), animations, 
     settings panel."
```

### Each prompt should specify:
- Which files to create or modify
- Which message types are involved
- What the expected behavior is
- Reference this CLAUDE.md for architecture decisions

---

## Scaling Notes

This architecture is designed for **small-to-medium company teams** (5–100 people). At this scale:

- SQLite handles it easily (thousands of tasks, hundreds of ideas)
- A single WebSocket server handles hundreds of concurrent connections
- All traffic stays on the local network — latency is sub-millisecond

If you grow beyond ~200 concurrent users, consider:
- Swapping SQLite for PostgreSQL
- Adding Redis for pub/sub message routing
- Running multiple server instances behind a load balancer
- Sharding by group

But don't prematurely optimize. SQLite on a local network is shockingly fast for this use case.

---

## Common Pitfalls

- **Don't expose `better-sqlite3` to the renderer** — All DB access through IPC or WebSocket
- **Don't skip message signing** — Even on a "trusted" network, spoofing is trivial without it
- **Don't use REST for real-time features** — WebSockets exist for this exact reason
- **Don't store private keys in the database** — They live only on the user's machine
- **Don't make the window too large** — It's a widget (380px wide), not a full app
- **Don't add features outside the module system** — Every feature is a module, no exceptions
- **Don't forget offline queue** — Network blips happen; queue messages and retry

---

## Summary

The key insight: **everything is a message**. The message protocol is the spine of the system. Tasks, ideas, votes, presence updates, future features — all messages flowing through the same pipeline. The server routes them by scope, the client dispatches them by type. Adding a feature means defining new message types and writing a handler. Nothing else changes.

SSH-style keys for identity. WebSockets for real-time sync. SQLite for storage. Electron for the always-on-top desktop widget. Each layer does one thing well.