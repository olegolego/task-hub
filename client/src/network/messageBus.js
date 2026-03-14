import { ipc } from '../utils/ipc'
import { useTaskStore } from '../store/taskStore'
import { useIdeaStore } from '../store/ideaStore'
import { useGroupStore } from '../store/groupStore'
import { useUserStore } from '../store/userStore'
import { useConnectionStore } from '../store/connectionStore'
import { useMessageStore } from '../store/messageStore'

/**
 * Subscribes to IPC message and state events and routes them to the appropriate stores.
 * Returns a cleanup function to remove listeners.
 */
export function initMessageBus() {
  const cleanupMsg = ipc.onMessage((msg) => {
    const { type, data } = msg

    switch (type) {
      // ── Auth ────────────────────────────────────────────────────────────────
      case 'auth:success':
        useConnectionStore.getState().setMyUser(msg.user)
        break

      // ── Sync ────────────────────────────────────────────────────────────────
      case 'sync:response':
        if (data) {
          useTaskStore.getState().setTasks(data.tasks || [])
          useIdeaStore.getState().setIdeas(data.ideas || [])
          useGroupStore.getState().setGroups(data.groups || [])
          useUserStore.getState().setUsers(data.users || [])
          useUserStore.getState().setOnlineUsers(data.onlineUsers || [])
          useUserStore.getState().setPendingUsers(data.pendingUsers || [])
        }
        break

      // ── Tasks ───────────────────────────────────────────────────────────────
      case 'task:created':
        useTaskStore.getState().addTaskFromServer(msg.task)
        break

      case 'task:updated':
        useTaskStore.getState().updateTaskFromServer(msg.task)
        break

      case 'task:deleted':
        useTaskStore.getState().removeTaskFromServer(msg.id)
        break

      // ── Ideas ───────────────────────────────────────────────────────────────
      case 'idea:posted':
        useIdeaStore.getState().addIdeaFromServer(msg.idea)
        break

      case 'idea:updated':
        useIdeaStore.getState().updateIdeaFromServer(msg.idea)
        break

      case 'idea:voted':
        useIdeaStore.getState().applyVoteFromServer(msg)
        break

      case 'idea:commented':
        // Future: update comment count on idea
        break

      // ── Groups ──────────────────────────────────────────────────────────────
      case 'group:created':
        useGroupStore.getState().addGroupFromServer(msg.group)
        break

      case 'group:member_joined':
        useGroupStore.getState().handleMemberJoined(msg)
        break

      case 'group:member_left':
        useGroupStore.getState().handleMemberLeft(msg)
        break

      // ── Presence ────────────────────────────────────────────────────────────
      case 'user:online':
        useUserStore.getState().setUserOnline(msg.userId)
        break

      case 'user:offline':
        useUserStore.getState().setUserOffline(msg.userId)
        break

      case 'user:status':
        // Could show status badges in future
        break

      // ── Approval flow ────────────────────────────────────────────────────────
      case 'user:pending':
        // Tell this client they're waiting for admin approval
        useConnectionStore.getState().setMyStatus('pending')
        break

      case 'user:join_pending':
        // Admin receives notification of a new pending user
        if (msg.user) useUserStore.getState().addPendingUser(msg.user)
        break

      case 'user:approved':
        if (msg.userId) {
          // Remove from pending list; they'll appear in the online list via user:online
          useUserStore.getState().removePendingUser(msg.userId)
        } else {
          // This message was sent to the approved user themselves (no userId field)
          useConnectionStore.getState().setMyStatus('active')
        }
        break

      // ── Direct messages ─────────────────────────────────────────────────────
      case 'dm:received':
        if (msg.dm) useMessageStore.getState().addMessage(msg.dm)
        break

      case 'dm:history_response':
        if (msg.withUserId && msg.messages) {
          useMessageStore.getState().setHistory(msg.withUserId, msg.messages)
        }
        break

      // ── Errors ──────────────────────────────────────────────────────────────
      case 'error':
        console.error('[MessageBus] Server error:', msg.error)
        break

      default:
        // Silently ignore unknown message types
        break
    }
  })

  const cleanupState = ipc.onConnectionState((state) => {
    useConnectionStore.getState().setState(state)
  })

  return () => {
    cleanupMsg()
    cleanupState()
  }
}
