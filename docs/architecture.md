# Task-Hub Architecture

## Overview

Task-Hub is a real-time collaborative task management desktop app built with:

- **Frontend**: React 18 + Zustand + Vite + Tailwind CSS (Electron desktop app)
- **Backend**: Node.js WebSocket server with SQLite (better-sqlite3)
- **Shared**: TypeScript types, message constants, and Zod validation schemas

## Project Structure

```
task-hub/
├── shared/           # Shared types, constants, validation schemas
│   └── src/
│       ├── index.ts          # MESSAGE_TYPES, PRIORITIES, TASK_STATUS, etc.
│       ├── types/            # TypeScript interfaces for all domain entities
│       └── validation/       # Zod schemas for all mutation payloads
├── server/           # WebSocket server
│   └── src/
│       ├── index.ts          # Entry point
│       ├── server.ts         # HTTP + WebSocket server, auth flow, routing
│       ├── config.ts         # Environment configuration (Zod-validated)
│       ├── auth/
│       │   ├── challenge.ts  # Ed25519 challenge-response authentication
│       │   └── permissions.ts # Centralized permission checks
│       ├── db/
│       │   └── database.ts   # SQLite initialization + migrations
│       ├── middleware/
│       │   ├── validate.ts   # Zod payload validation
│       │   └── rateLimit.ts  # Per-user sliding window rate limiter
│       ├── modules/          # Feature modules (task, idea, group, etc.)
│       │   ├── types.ts      # Module interface definition
│       │   ├── moduleRegistry.ts
│       │   └── *.module.ts   # Individual feature modules
│       └── utils/
│           └── logger.ts     # Structured logging
├── client/           # Electron + React frontend
│   └── src/
│       ├── App.tsx           # Root component
│       ├── main.tsx          # React entry with ErrorBoundary + ToastProvider
│       ├── components/
│       │   ├── common/       # Reusable UI: Button, Input, Modal, Toast, etc.
│       │   ├── layout/       # Sidebar, StatusBar
│       │   ├── calendar/     # CalendarPanel
│       │   ├── files/        # FilesPanel
│       │   ├── groups/       # GroupPanel
│       │   ├── ideas/        # IdeasBoard, IdeaCard, IdeaComposer
│       │   ├── llm/          # LLMPanel
│       │   ├── messages/     # MessagesPanel
│       │   ├── people/       # PeoplePanel
│       │   └── setup/        # SetupScreen
│       ├── hooks/            # useShortcuts, useDebounce, useUndoRedo
│       ├── store/            # 10 Zustand stores
│       ├── network/          # WebSocket messageBus
│       └── utils/            # IPC bridge, constants
└── docs/             # Documentation
```

## Authentication

Ed25519 keypair-based (no passwords):

1. Server sends random UUID challenge
2. Client signs with private key (`~/.taskmanager/id_ed25519`)
3. Server verifies signature, derives user ID from SHA-256 fingerprint of public key
4. First user auto-promoted to admin; subsequent users start as "pending"

## Encryption

- **DMs**: X25519 ECDH key exchange → XSalsa20-Poly1305 AEAD encryption
- **Files in DMs**: E2E encrypted with per-file symmetric keys
- **Company files**: Stored plaintext (shared, not E2E)
- **Message signing**: Ed25519 detached signatures on all WebSocket messages

## Module System

Server features are organized as modules registered in `moduleRegistry.ts`. Each module:

- Declares which message types it handles
- Receives a typed `ModuleContext` with `db`, `ws`, `broadcast`, `clients`, etc.
- Validates payloads via shared Zod schemas
- Checks permissions via `auth/permissions.ts`

## Data Flow

1. Client sends WebSocket message with `{ type, payload, signature, timestamp }`
2. Server verifies signature, checks rate limits, validates payload
3. Module handles the message, updates SQLite, broadcasts response
4. Client stores update Zustand state, React re-renders
