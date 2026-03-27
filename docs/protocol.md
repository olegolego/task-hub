# WebSocket Protocol Reference

All messages are JSON objects with `{ type, payload?, signature?, timestamp? }`.

## Authentication

| Type             | Direction | Payload                                                            | Description              |
| ---------------- | --------- | ------------------------------------------------------------------ | ------------------------ |
| `auth:challenge` | S→C       | `{ challenge }`                                                    | Server sends random UUID |
| `auth:response`  | C→S       | `{ publicKey, encPublicKey?, signature, displayName?, challenge }` | Client signs challenge   |
| `auth:success`   | S→C       | `{ user }`                                                         | Auth succeeded           |
| `auth:fail`      | S→C       | `{ error }`                                                        | Auth failed              |
| `sync:response`  | S→C       | `{ data: { tasks, groups, users, ... } }`                          | Initial state sync       |

## Tasks

| Type            | Direction | Payload                                                                   |
| --------------- | --------- | ------------------------------------------------------------------------- |
| `task:create`   | C→S       | `{ title, description?, priority?, assignedTo?, groupId?, dueDate? }`     |
| `task:created`  | S→C       | `{ task }`                                                                |
| `task:update`   | C→S       | `{ id, title?, priority?, status?, assignedTo?, dueDate?, description? }` |
| `task:updated`  | S→C       | `{ task }`                                                                |
| `task:complete` | C→S       | `{ id, completed }`                                                       |
| `task:delete`   | C→S       | `{ id }`                                                                  |
| `task:deleted`  | S→C       | `{ id }`                                                                  |
| `task:assign`   | C→S       | `{ id, assignedTo }`                                                      |

## Ideas

| Type             | Direction | Payload                                 |
| ---------------- | --------- | --------------------------------------- |
| `idea:post`      | C→S       | `{ title, body?, groupId?, category? }` |
| `idea:posted`    | S→C       | `{ idea }`                              |
| `idea:vote`      | C→S       | `{ ideaId, vote }` (1 or -1)            |
| `idea:voted`     | S→C       | `{ ideaId, userId, vote, voteCount }`   |
| `idea:comment`   | C→S       | `{ ideaId, body }`                      |
| `idea:commented` | S→C       | `{ comment, commentCount }`             |
| `idea:status`    | C→S       | `{ ideaId, status }`                    |
| `idea:delete`    | C→S       | `{ ideaId }`                            |

## Groups

| Type                   | Direction | Payload                  |
| ---------------------- | --------- | ------------------------ |
| `group:create`         | C→S       | `{ name, description? }` |
| `group:created`        | S→C       | `{ group }`              |
| `group:join`           | C→S       | `{ groupId }`            |
| `group:leave`          | C→S       | `{ groupId }`            |
| `group:invite`         | C→S       | `{ groupId, userId }`    |
| `group:invite_respond` | C→S       | `{ inviteId, accept }`   |
| `group:join_respond`   | C→S       | `{ inviteId, accept }`   |
| `group:members`        | C→S       | `{ groupId }`            |

## Direct Messages (E2E Encrypted)

| Type                  | Direction | Payload                                                     |
| --------------------- | --------- | ----------------------------------------------------------- |
| `dm:send`             | C→S       | `{ toUserId, encrypted?, nonce?, fileId?, fileName?, ... }` |
| `dm:received`         | S→C       | `{ dm }`                                                    |
| `dm:history`          | C→S       | `{ withUserId, limit? }`                                    |
| `dm:history_response` | S→C       | `{ withUserId, messages }`                                  |
| `dm:edit`             | C→S       | `{ dmId, encrypted, nonce }`                                |
| `dm:delete`           | C→S       | `{ dmId }`                                                  |
| `dm:react`            | C→S       | `{ dmId, emoji }`                                           |

## Presence

| Type           | Direction | Payload                   |
| -------------- | --------- | ------------------------- |
| `user:online`  | S→C       | `{ userId, displayName }` |
| `user:offline` | S→C       | `{ userId }`              |
| `user:status`  | C→S       | `{ status }`              |
| `user:list`    | C→S       | (none)                    |
| `user:approve` | C→S       | `{ userId }` (admin only) |

## Meetings

| Type              | Direction | Payload                                                               |
| ----------------- | --------- | --------------------------------------------------------------------- |
| `meeting:create`  | C→S       | `{ title, description?, startTime, endTime, attendeeIds?, groupId? }` |
| `meeting:respond` | C→S       | `{ meetingId, status }` (accepted/declined)                           |
| `meeting:delete`  | C→S       | `{ meetingId }`                                                       |
| `meeting:list`    | C→S       | (none)                                                                |

## LLM

| Type                | Direction | Payload                                          |
| ------------------- | --------- | ------------------------------------------------ |
| `llm:ask`           | C→S       | `{ question, context?, fileIds? }`               |
| `llm:response`      | S→C       | `{ requestId, answer, model, usage }`            |
| `llm:chat`          | C→S       | `{ message, chatId?, useCompanyData? }`          |
| `llm:chat_response` | S→C       | `{ chatId, message, model, usage, contextUsed }` |
| `llm:chat_new`      | C→S       | `{ title? }`                                     |
| `llm:chat_list`     | C→S       | (none)                                           |
| `llm:chat_delete`   | C→S       | `{ chatId }`                                     |
| `llm:chat_rename`   | C→S       | `{ chatId, title }`                              |
| `llm:status`        | C→S       | (none)                                           |

## Company Files

| Type                  | Direction | Payload                 |
| --------------------- | --------- | ----------------------- |
| `files:list`          | C→S       | (none)                  |
| `files:delete`        | C→S       | `{ fileId }`            |
| `files:rename`        | C→S       | `{ fileId, name }`      |
| `files:create_folder` | C→S       | `{ name }`              |
| `files:delete_folder` | C→S       | `{ name }` (admin only) |
