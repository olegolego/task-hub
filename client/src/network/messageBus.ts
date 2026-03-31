// @ts-nocheck
import { ipc } from '../utils/ipc'
import { useTaskStore } from '../store/taskStore'
import { useIdeaStore } from '../store/ideaStore'
import { useGroupStore } from '../store/groupStore'
import { useUserStore } from '../store/userStore'
import { useConnectionStore } from '../store/connectionStore'
import { useMessageStore } from '../store/messageStore'
import { useFilesStore } from '../store/filesStore'
import { useGroupChatStore } from '../store/groupChatStore'
import { useMeetingsStore } from '../store/meetingsStore'
import { useLLMStore } from '../store/llmStore'
import { useActivityStore } from '../store/activityStore'

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
          useGroupStore.getState().setPendingInvites(data.pendingInvites || [])
          useGroupStore.getState().setPendingJoinRequests(data.pendingJoinRequests || [])
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
        useIdeaStore.getState().addComment(msg.comment, msg.commentCount)
        break

      case 'idea:comments_response':
        useIdeaStore.getState().setComments(msg.ideaId, msg.comments)
        break

      case 'idea:deleted':
        useIdeaStore.getState().removeIdea(msg.ideaId || msg.id)
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

      case 'group:invited':
        useGroupStore.getState().handleInvited(msg)
        break

      // Someone invited us to a group — show accept/decline prompt
      case 'group:invite_received':
        useGroupStore.getState().addPendingInvite({
          inviteId: msg.inviteId,
          groupId: msg.groupId,
          groupName: msg.groupName,
          groupColor: msg.groupColor,
          fromId: msg.fromId,
          fromName: msg.fromName,
        })
        break

      // Someone requested to join a group we admin — show approve/deny
      case 'group:join_requested':
        useGroupStore.getState().addPendingJoinRequest({
          inviteId: msg.inviteId,
          groupId: msg.groupId,
          groupName: msg.groupName,
          requesterId: msg.requesterId,
          requesterName: msg.requesterName,
          requesterColor: msg.requesterColor,
        })
        break

      // Admin resolved a join request
      case 'group:join_request_resolved':
        useGroupStore.getState().removePendingJoinRequest(msg.inviteId)
        break

      case 'group:members':
        if (msg.groupId && msg.members) {
          useGroupStore.getState().setGroupMembers(msg.groupId, msg.members)
        }
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
          // Remove from pending list and add to the active users list
          useUserStore.getState().removePendingUser(msg.userId)
          if (msg.user) useUserStore.getState().addUser(msg.user)
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

      // ── DM edit ─────────────────────────────────────────────────────────────
      case 'dm:edited':
        if (msg.dmId && msg.text !== undefined)
          useMessageStore.getState().markEdited(msg.dmId, msg.text)
        break

      // ── DM delete ───────────────────────────────────────────────────────────
      case 'dm:deleted':
        useMessageStore.getState().markDeleted(msg.dmId)
        break

      // ── Company files ────────────────────────────────────────────────────────
      case 'files:list_response':
        useFilesStore.getState().setFiles(msg.files || [])
        useFilesStore.getState().setFolders(msg.folders || [])
        useFilesStore.setState({ loading: false })
        break

      case 'files:uploaded':
        if (msg.file) useFilesStore.getState().addFile(msg.file)
        break

      case 'files:deleted':
        useFilesStore.getState().removeFile(msg.fileId)
        break

      case 'files:renamed':
        if (msg.fileId && msg.name) useFilesStore.getState().updateFileName(msg.fileId, msg.name)
        break

      case 'files:folder_created':
        if (msg.name) useFilesStore.getState().addFolder(msg.name)
        break

      case 'files:folder_deleted':
        if (msg.name) useFilesStore.getState().removeFolder(msg.name)
        break

      // ── Group chat ───────────────────────────────────────────────────────────
      case 'group:message_received':
        if (msg.message) useGroupChatStore.getState().addMessage(msg.message)
        break

      case 'group:history_response':
        if (msg.groupId && msg.messages)
          useGroupChatStore.getState().setHistory(msg.groupId, msg.messages)
        break

      // ── Meetings ─────────────────────────────────────────────────────────────
      case 'meeting:list_response':
        useMeetingsStore.getState().setMeetings(msg.meetings)
        break

      case 'meeting:created':
        useMeetingsStore.getState().addMeeting(msg.meeting)
        break

      case 'meeting:updated':
        useMeetingsStore.getState().updateMeeting(msg.meeting)
        break

      case 'meeting:deleted':
        useMeetingsStore.getState().removeMeeting(msg.meetingId)
        break

      // ── LLM ──────────────────────────────────────────────────────────────────
      case 'llm:status_response':
        useLLMStore.getState().setStatus(msg.status, msg.model)
        break

      case 'llm:chat_created':
        if (msg.chat) {
          useLLMStore.getState().addChat(msg.chat)
          useLLMStore.getState().selectChat(msg.chat.id)
        }
        break

      case 'llm:chat_list_response':
        useLLMStore.getState().setChats(msg.chats || [])
        break

      case 'llm:chat_history_response':
        if (msg.chat && msg.messages) {
          useLLMStore.setState({ loadingHistory: false })
          useLLMStore.getState().setMessages(msg.chat.id, msg.messages)
        }
        break

      case 'llm:thinking':
        useLLMStore.getState().setThinking(true)
        // If the chat was auto-created on server, update activeChatId
        if (msg.chatId && !useLLMStore.getState().activeChatId) {
          useLLMStore.setState({ activeChatId: msg.chatId })
        }
        break

      case 'llm:chat_response': {
        const llm = useLLMStore.getState()
        llm.setThinking(false)
        if (msg.chatId && msg.message) {
          llm.addMessage(msg.chatId, msg.message)
          // Ensure this chat is in the list (auto-created chats arrive here first)
          if (!llm.chats.find((c) => c.id === msg.chatId)) {
            llm.loadChats()
          }
          if (!llm.activeChatId) {
            useLLMStore.setState({ activeChatId: msg.chatId })
          }
        }
        break
      }

      case 'llm:chat_deleted':
        if (msg.chatId) useLLMStore.getState().removeChat(msg.chatId)
        break

      case 'llm:chat_renamed':
        if (msg.chatId && msg.title) useLLMStore.getState().updateChatTitle(msg.chatId, msg.title)
        break

      case 'llm:error':
        useLLMStore.getState().setError(msg.error || 'Unknown LLM error')
        break

      // ── Activity feed ─────────────────────────────────────────────────────
      case 'activity:list_response':
        useActivityStore.getState().setActivities(msg.activities || [])
        break

      // ── DM reactions ────────────────────────────────────────────────────
      case 'dm:reacted':
        if (msg.dmId && msg.reactions) {
          useMessageStore.getState().setReactions(msg.dmId, msg.reactions)
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
